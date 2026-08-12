import { v4 as uuid } from 'uuid';
import { db, now } from '../db/index.js';
import { extractEmail, extractName, normalizeEmail } from '../utils/generate.js';
import { findAddressByEmail } from './addresses.js';

const insertMessage = db.prepare(`
  INSERT INTO messages (
    id, address_id, thread_id, direction, from_addr, from_name, to_addr,
    subject, body_text, body_html, headers_json, in_reply_to, created_at, is_read
  ) VALUES (
    @id, @address_id, @thread_id, @direction, @from_addr, @from_name, @to_addr,
    @subject, @body_text, @body_html, @headers_json, @in_reply_to, @created_at, @is_read
  )
`);

const getMessage = db.prepare('SELECT * FROM messages WHERE id = ?');
const listByAddress = db.prepare(`
  SELECT * FROM messages WHERE address_id = ? ORDER BY created_at DESC
`);
const listThread = db.prepare(`
  SELECT * FROM messages WHERE thread_id = ? ORDER BY created_at ASC
`);
const markRead = db.prepare('UPDATE messages SET is_read = 1 WHERE thread_id = ? AND address_id = ?');
const unreadCount = db.prepare(`
  SELECT COUNT(*) AS n FROM messages WHERE address_id = ? AND is_read = 0 AND direction = 'inbound'
`);
const latestByAddress = db.prepare(`
  SELECT * FROM messages WHERE address_id = ? AND created_at > ? ORDER BY created_at ASC
`);

const listeners = new Set();

export function subscribe(addressId, send) {
  const rec = { addressId, send };
  listeners.add(rec);
  return () => listeners.delete(rec);
}

function emit(addressId, event, data) {
  for (const rec of listeners) {
    if (rec.addressId === addressId) {
      try { rec.send(event, data); } catch { /* ignore hung sockets */ }
    }
  }
}

export function publicMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    addressId: row.address_id,
    threadId: row.thread_id,
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

export function storeMessage({
  addressId,
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
  const parent = inReplyTo ? getMessage.get(inReplyTo) : null;
  const id = uuid();
  const row = {
    id,
    address_id: addressId,
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
    is_read: isRead,
  };
  insertMessage.run(row);
  const saved = getMessage.get(id);
  emit(addressId, 'message', publicMessage(saved));
  return saved;
}

export function ingestInbound({ to, from, fromName, subject, bodyText, bodyHtml, headers, inReplyTo }) {
  const dest = extractEmail(to);
  const address = findAddressByEmail(dest);
  if (!address) {
    const err = new Error(`No mailbox for ${dest}`);
    err.status = 404;
    throw err;
  }
  return storeMessage({
    addressId: address.id,
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

export function insertWelcome(addressId, email) {
  return storeMessage({
    addressId,
    direction: 'inbound',
    from: 'postmaster@persistmail.io',
    fromName: 'PersistMail',
    to: email,
    subject: 'Your persistent mailbox is live',
    bodyText: [
      `Welcome. ${email} is now reserved on this service.`,
      '',
      'This address is persistent. Save your access key — it is the only way to reopen this inbox from another device or platform.',
      '',
      'You can receive mail over SMTP on port 2525 (or via the inject API in development).',
      'Outbound replies are limited to 3 per 24 hours per address.',
      '',
      '— PersistMail v2.0.0',
    ].join('\n'),
    bodyHtml: '',
    isRead: 0,
  });
}

export function listInbox(addressId) {
  const rows = listByAddress.all(addressId);
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
  return {
    unread: unreadCount.get(addressId).n,
    threads: [...threads.values()],
    messages: rows.map(publicMessage),
  };
}

export function getThread(addressId, threadId) {
  const rows = listThread.all(threadId).filter((r) => r.address_id === addressId);
  if (!rows.length) {
    const err = new Error('Thread not found');
    err.status = 404;
    throw err;
  }
  markRead.run(threadId, addressId);
  return {
    threadId,
    subject: rows[0].subject || '(no subject)',
    messages: rows.map(publicMessage),
  };
}

export function getOwnedMessage(addressId, messageId) {
  const row = getMessage.get(messageId);
  if (!row || row.address_id !== addressId) {
    const err = new Error('Message not found');
    err.status = 404;
    throw err;
  }
  return row;
}

export function messagesSince(addressId, since) {
  return latestByAddress.all(addressId, Number(since) || 0).map(publicMessage);
}
