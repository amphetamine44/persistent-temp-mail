import { v4 as uuid } from 'uuid';
import { Message, now } from '../db/index.js';
import { extractEmail, extractName, normalizeEmail } from '../utils/generate.js';
import { findAddressByEmail } from './addresses.js';

function asRow(doc) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  o.id = o._id;
  return o;
}

export function scopedFilter(addressId, extra = {}) {
  if (!addressId) {
    const err = new Error('Session has no mailbox scope');
    err.status = 401;
    throw err;
  }
  return { address_id: addressId, ...extra };
}

export function publicMessage(row) {
  if (!row) return null;
  return {
    id: row.id || row._id,
    addressId: row.address_id,
    threadId: row.thread_id,
    sessionId: row.session_id || null,
    direction: row.direction,
    from: row.from_addr,
    fromName: row.from_name || '',
    to: row.to_addr,
    subject: row.subject || '(no subject)',
    bodyText: row.body_text || '',
    bodyHtml: row.body_html || '',
    inReplyTo: row.in_reply_to,
    createdAt: row.created_at,
    isRead: Boolean(row.is_read),
  };
}

export async function storeMessage({
  addressId,
  sessionId = null,
  direction,
  from,
  fromName,
  to,
  subject,
  bodyText,
  bodyHtml,
  headers,
  inReplyTo,
  threadId,
  isRead = 0,
}) {
  const parent = inReplyTo
    ? asRow(await Message.findOne(scopedFilter(addressId, { _id: inReplyTo })))
    : null;
  const id = uuid();
  const row = {
    _id: id,
    address_id: addressId,
    session_id: sessionId || null,
    thread_id: threadId || parent?.thread_id || id,
    direction,
    from_addr: normalizeEmail(from),
    from_name: fromName || '',
    to_addr: normalizeEmail(to),
    subject: subject || '',
    body_text: bodyText || '',
    body_html: bodyHtml || '',
    headers_json: headers ? JSON.stringify(headers) : null,
    in_reply_to: inReplyTo || parent?.id || null,
    created_at: now(),
    is_read: Boolean(isRead),
  };
  await Message.create(row);
  return asRow(await Message.findOne(scopedFilter(addressId, { _id: id })));
}

export async function ingestInbound({ to, from, fromName, subject, bodyText, bodyHtml, headers, inReplyTo }) {
  const dest = extractEmail(to);
  const address = await findAddressByEmail(dest);
  if (!address) {
    const err = new Error(`No mailbox for ${dest}`);
    err.status = 404;
    throw err;
  }
  return storeMessage({
    addressId: address.id,
    sessionId: null,
    direction: 'inbound',
    from: extractEmail(from) || from,
    fromName: fromName || extractName(from),
    to: dest,
    subject,
    bodyText,
    bodyHtml,
    headers,
    inReplyTo,
  });
}

export async function insertWelcome(addressId, email) {
  return storeMessage({
    addressId,
    direction: 'inbound',
    from: 'postmaster@edu.as',
    fromName: 'PersistMail',
    to: email,
    subject: 'Your persistent mailbox is live',
    bodyText: [
      `Welcome. ${email} is now reserved on this service.`,
      '',
      'This address is persistent. Save your access key — it is the only way to reopen this inbox from another device or platform.',
      '',
      'You can receive mail over SMTP on port 2525 (or via the inject API in development).',
      'Outbound send and reply are unlimited. Delete any message from the client.',
      '',
      '— PersistMail v2.0.0',
    ].join('\n'),
    bodyHtml: '',
    isRead: 0,
  });
}

export async function listInbox(addressId) {
  const rows = (await Message.find(scopedFilter(addressId)).sort({ created_at: -1 })).map(asRow);
  const threads = new Map();
  for (const row of rows) {
    if (!threads.has(row.thread_id)) {
      const threadRows = rows.filter((r) => r.thread_id === row.thread_id);
      const latest = threadRows[0];
      const unread = threadRows.filter((r) => !r.is_read && r.direction === 'inbound').length;
      threads.set(row.thread_id, {
        threadId: row.thread_id,
        subject: latest.subject || '(no subject)',
        preview: (latest.body_text || '').replace(/\s+/g, ' ').slice(0, 160),
        from: latest.from_addr,
        fromName: latest.from_name || '',
        to: latest.to_addr,
        lastAt: latest.created_at,
        count: threadRows.length,
        unread,
        latest: publicMessage(latest),
      });
    }
  }
  const unread = await Message.countDocuments(scopedFilter(addressId, {
    is_read: false,
    direction: 'inbound',
  }));
  return {
    unread,
    threads: [...threads.values()],
    messages: rows.map(publicMessage),
  };
}

export async function getThread(addressId, threadId) {
  const rows = (await Message.find(scopedFilter(addressId, { thread_id: threadId })).sort({ created_at: 1 })).map(asRow);
  if (!rows.length) {
    const err = new Error('Thread not found');
    err.status = 404;
    throw err;
  }
  await Message.updateMany(scopedFilter(addressId, { thread_id: threadId }), { is_read: true });
  return {
    threadId,
    subject: rows[0].subject || '(no subject)',
    messages: rows.map(publicMessage),
  };
}

export async function getOwnedMessage(addressId, messageId) {
  const row = asRow(await Message.findOne(scopedFilter(addressId, { _id: messageId })));
  if (!row) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }
  return row;
}

export async function deleteMessage(addressId, messageId) {
  const row = await getOwnedMessage(addressId, messageId);
  await Message.deleteOne(scopedFilter(addressId, { _id: messageId }));
  return { deleted: true, id: messageId, threadId: row.thread_id };
}

export async function messagesSince(addressId, since) {
  const rows = await Message.find(scopedFilter(addressId, {
    created_at: { $gt: Number(since) || 0 },
  })).sort({ created_at: 1 });
  return rows.map((r) => publicMessage(asRow(r)));
}
