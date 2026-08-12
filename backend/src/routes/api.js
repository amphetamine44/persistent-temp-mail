import { Router } from 'express';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { limit } from '../middleware/rateLimit.js';
import {
  createAddress,
  listDomains,
  loginAddress,
  logoutSession,
  publicAddress,
} from '../services/addresses.js';
import {
  getOwnedMessage,
  getThread,
  ingestInbound,
  insertWelcome,
  listInbox,
  messagesSince,
  publicMessage,
  subscribe,
} from '../services/mail.js';
import { replyQuota, sendReply } from '../services/replies.js';

export const api = Router();

api.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'Persistent Temp Mail Service',
    version: '2.0.0',
    smtpPort: config.smtpPort,
    domains: config.domains.length,
  });
});

api.get('/domains', (_req, res) => {
  res.json(listDomains());
});

api.post('/addresses', limit(30, 60_000, 'gen'), (req, res) => {
  try {
    const { localPart, domain } = req.body || {};
    const result = createAddress({ localPart, domain });
    res.status(201).json({
      ...result,
      warning: 'Store the access key now. It cannot be recovered later.',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/auth/login', limit(20, 60_000, 'login'), (req, res) => {
  try {
    const { email, accessKey } = req.body || {};
    res.json(loginAddress(email, accessKey));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/auth/logout', requireAuth, (req, res) => {
  logoutSession(req.sessionToken);
  res.json({ ok: true });
});

api.get('/me', requireAuth, (req, res) => {
  res.json({
    address: publicAddress(req.address),
    quota: replyQuota(req.address.id),
  });
});

api.get('/inbox', requireAuth, (req, res) => {
  res.json({
    address: publicAddress(req.address),
    quota: replyQuota(req.address.id),
    ...listInbox(req.address.id),
  });
});

api.get('/inbox/poll', requireAuth, (req, res) => {
  const since = Number(req.query.since || 0);
  res.json({
    now: Date.now(),
    messages: messagesSince(req.address.id, since),
    quota: replyQuota(req.address.id),
  });
});

api.get('/inbox/stream', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send('hello', { addressId: req.address.id, at: Date.now() });
  const unsub = subscribe(req.address.id, send);
  const ping = setInterval(() => send('ping', { at: Date.now() }), 25000);

  req.on('close', () => {
    clearInterval(ping);
    unsub();
  });
});

api.get('/threads/:threadId', requireAuth, (req, res) => {
  try {
    res.json({
      quota: replyQuota(req.address.id),
      ...getThread(req.address.id, req.params.threadId),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.get('/messages/:id', requireAuth, (req, res) => {
  try {
    const row = getOwnedMessage(req.address.id, req.params.id);
    res.json({ message: publicMessage(row), quota: replyQuota(req.address.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/messages/:id/reply', requireAuth, limit(12, 60_000, 'reply'), (req, res) => {
  try {
    const result = sendReply(req.address, {
      messageId: req.params.id,
      body: req.body?.body,
      subject: req.body?.subject,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, quota: err.quota });
  }
});

api.get('/quota', requireAuth, (req, res) => {
  res.json(replyQuota(req.address.id));
});

if (config.devInject) {
  api.post('/dev/inject', limit(60, 60_000, 'inject'), (req, res) => {
    try {
      const { to, from, fromName, subject, body, html } = req.body || {};
      if (!to || !from) {
        return res.status(400).json({ error: 'to and from are required' });
      }
      const saved = ingestInbound({
        to,
        from,
        fromName,
        subject: subject || 'Test message',
        bodyText: body || '',
        bodyHtml: html || '',
      });
      res.status(201).json({ message: publicMessage(saved) });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });
}

export { insertWelcome };
