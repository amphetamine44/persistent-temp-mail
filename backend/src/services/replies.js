import nodemailer from 'nodemailer';
import { v4 as uuid } from 'uuid';
import { ReplyLog, now } from '../db/index.js';
import { config } from '../config.js';
import { findAddressByEmail } from './addresses.js';
import { getOwnedMessage, storeMessage } from './mail.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function replyQuota(addressId) {
  const used = await ReplyLog.countDocuments({ address_id: addressId });
  return {
    limit: null,
    used,
    remaining: null,
    unlimited: true,
    windowHours: null,
    resetsAt: null,
  };
}

async function deliverSmtp(from, to, subject, text) {
  if (!config.smtpOut.host) return { sent: false, reason: 'no-relay' };
  const transport = nodemailer.createTransport({
    host: config.smtpOut.host,
    port: config.smtpOut.port,
    secure: config.smtpOut.port === 465,
    auth: config.smtpOut.user
      ? { user: config.smtpOut.user, pass: config.smtpOut.pass }
      : undefined,
  });
  await transport.sendMail({ from, to, subject, text });
  return { sent: true };
}

function assertRecipient(to) {
  const dest = String(to || '').trim().toLowerCase();
  if (!EMAIL_RE.test(dest)) {
    const err = new Error('Enter a valid recipient email');
    err.status = 400;
    throw err;
  }
  return dest;
}

function assertBody(body) {
  const text = String(body || '').trim();
  if (!text) {
    const err = new Error('Message body cannot be empty');
    err.status = 400;
    throw err;
  }
  if (text.length > 20000) {
    const err = new Error('Message body exceeds 20,000 characters');
    err.status = 400;
    throw err;
  }
  return text;
}

async function finalizeOutbound(address, { dest, subj, text, saved, localThread = true }) {
  await ReplyLog.create({
    _id: uuid(),
    address_id: address.id,
    message_id: saved.id,
    sent_at: now(),
  });

  const localDest = await findAddressByEmail(dest);
  if (localDest && localThread) {
    await storeMessage({
      addressId: localDest.id,
      sessionId: null,
      direction: 'inbound',
      from: address.email,
      fromName: address.local_part,
      to: dest,
      subject: subj,
      bodyText: text,
    });
  }

  let smtp = { sent: false, reason: 'local-only' };
  try {
    smtp = await deliverSmtp(address.email, dest, subj, text);
  } catch (e) {
    smtp = { sent: false, reason: e.message };
  }

  return {
    message: {
      id: saved.id,
      addressId: saved.address_id,
      threadId: saved.thread_id,
      sessionId: saved.session_id,
      direction: saved.direction,
      from: saved.from_addr,
      to: saved.to_addr,
      subject: saved.subject,
      bodyText: saved.body_text,
      createdAt: saved.created_at,
    },
    quota: await replyQuota(address.id),
    deliveredLocally: Boolean(localDest),
    smtp,
  };
}

export async function composeSend(address, { to, subject, body, sessionId = null }) {
  const dest = assertRecipient(to);
  const text = assertBody(body);
  const subj = String(subject || '').trim() || '(no subject)';
  const saved = await storeMessage({
    addressId: address.id,
    sessionId,
    direction: 'outbound',
    from: address.email,
    fromName: address.local_part,
    to: dest,
    subject: subj,
    bodyText: text,
    isRead: 1,
  });
  return finalizeOutbound(address, { dest, subj, text, saved });
}

export async function sendReply(address, { messageId, body, subject, sessionId = null }) {
  const text = assertBody(body);
  const parent = await getOwnedMessage(address.id, messageId);
  const dest = parent.direction === 'inbound' ? parent.from_addr : parent.to_addr;
  if (!dest || dest === address.email) {
    const err = new Error('Cannot determine reply recipient');
    err.status = 400;
    throw err;
  }
  const subj = subject?.trim() || (parent.subject?.startsWith('Re:') ? parent.subject : `Re: ${parent.subject || '(no subject)'}`);
  const saved = await storeMessage({
    addressId: address.id,
    sessionId,
    direction: 'outbound',
    from: address.email,
    fromName: address.local_part,
    to: dest,
    subject: subj,
    bodyText: text,
    threadId: parent.thread_id,
    inReplyTo: parent.id,
    isRead: 1,
  });
  return finalizeOutbound(address, { dest, subj, text, saved });
}
