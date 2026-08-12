import { v4 as uuid } from 'uuid';
import { ReplyLog, now } from '../db/index.js';
import { config } from '../config.js';
import { findAddressByEmail } from './addresses.js';
import { getOwnedMessage, storeMessage } from './mail.js';

export async function replyQuota(addressId) {
  const windowStart = now() - config.replyWindowMs;
  const used = await ReplyLog.countDocuments({
    address_id: addressId,
    sent_at: { $gt: windowStart },
  });
  const remaining = Math.max(0, config.replyLimit - used);
  const oldest = await ReplyLog.findOne({
    address_id: addressId,
    sent_at: { $gt: windowStart },
  }).sort({ sent_at: 1 }).lean();
  return {
    limit: config.replyLimit,
    used,
    remaining,
    windowHours: config.replyWindowMs / (60 * 60 * 1000),
    resetsAt: used >= config.replyLimit && oldest ? oldest.sent_at + config.replyWindowMs : null,
  };
}

export async function sendReply(address, { messageId, body, subject }) {
  const quota = await replyQuota(address.id);
  if (quota.remaining <= 0) {
    const err = new Error(`Reply limit reached: ${config.replyLimit} replies per ${quota.windowHours} hours for this address.`);
    err.status = 429;
    err.quota = quota;
    throw err;
  }

  const text = String(body || '').trim();
  if (!text) {
    const err = new Error('Reply body cannot be empty');
    err.status = 400;
    throw err;
  }
  if (text.length > 20000) {
    const err = new Error('Reply body exceeds 20,000 characters');
    err.status = 400;
    throw err;
  }

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

  await ReplyLog.create({
    _id: uuid(),
    address_id: address.id,
    message_id: saved.id,
    sent_at: now(),
  });

  const localDest = await findAddressByEmail(dest);
  if (localDest) {
    await storeMessage({
      addressId: localDest.id,
      direction: 'inbound',
      from: address.email,
      fromName: address.local_part,
      to: dest,
      subject: subj,
      bodyText: text,
      inReplyTo: null,
    });
  }

  return {
    message: {
      id: saved.id,
      addressId: saved.address_id,
      threadId: saved.thread_id,
      direction: saved.direction,
      from: saved.from_addr,
      to: saved.to_addr,
      subject: saved.subject,
      bodyText: saved.body_text,
      createdAt: saved.created_at,
    },
    quota: await replyQuota(address.id),
    deliveredLocally: Boolean(localDest),
  };
}
