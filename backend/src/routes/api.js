import { Router } from 'express';
import mongoose from 'mongoose';
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
  deleteMessage,
  getOwnedMessage,
  getThread,
  ingestInbound,
  insertWelcome,
  listInbox,
  messagesSince,
  publicMessage,
} from '../services/mail.js';
import { composeSend, replyQuota, sendReply } from '../services/replies.js';
import { allZones, bindZone, recordsFor, registrarTable } from '../services/dns.js';

export const api = Router();

function mongoStatus() {
  if (!process.env.MONGODB_URI) return 'skipped';
  return mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
}

api.get('/health', (_req, res) => {
  const mongodb = mongoStatus();
  res.json({
    ok: mongodb === 'connected',
    service: 'Persistent Temp Mail Service',
    version: '2.0.0',
    smtpPort: config.smtpPort,
    domains: config.domains.length,
    serverless: Boolean(process.env.VERCEL),
    db: { mongodb },
    replyLimit: config.replyLimit,
  });
});

api.get('/domains', (_req, res) => {
  res.json(listDomains());
});

api.get('/dns', (_req, res) => {
  res.json({ primary: config.primaryDomain, zones: allZones() });
});

api.get('/dns/:domain', (req, res) => {
  const domain = String(req.params.domain || '').toLowerCase();
  const pack = recordsFor(domain);
  if (!pack) return res.status(404).json({ error: `No MX profile for ${domain}` });
  res.type('application/json').json({
    ...pack,
    bind: bindZone(domain),
    paste: registrarTable(domain),
  });
});

api.post('/addresses', limit(30, 60_000, 'gen'), async (req, res) => {
  try {
    const { localPart, domain } = req.body || {};
    const result = await createAddress({ localPart, domain });
    res.status(201).json({
      ...result,
      warning: 'Store the access key now. It cannot be recovered later.',
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/auth/login', limit(20, 60_000, 'login'), async (req, res) => {
  try {
    const { email, accessKey } = req.body || {};
    res.json(await loginAddress(email, accessKey));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/auth/logout', requireAuth, async (req, res) => {
  await logoutSession(req.sessionToken);
  res.json({ ok: true });
});

api.get('/me', requireAuth, async (req, res) => {
  res.json({
    address: publicAddress(req.address),
    sessionId: req.sessionId,
    quota: await replyQuota(req.address.id),
  });
});

api.get('/inbox', requireAuth, async (req, res) => {
  res.json({
    address: publicAddress(req.address),
    sessionId: req.sessionId,
    quota: await replyQuota(req.address.id),
    ...(await listInbox(req.address.id)),
  });
});

api.get('/inbox/poll', requireAuth, async (req, res) => {
  const since = Number(req.query.since || 0);
  res.json({
    now: Date.now(),
    sessionId: req.sessionId,
    messages: await messagesSince(req.address.id, since),
    quota: await replyQuota(req.address.id),
  });
});

api.get('/threads/:threadId', requireAuth, async (req, res) => {
  try {
    res.json({
      quota: await replyQuota(req.address.id),
      ...(await getThread(req.address.id, req.params.threadId)),
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.get('/messages/:id', requireAuth, async (req, res) => {
  try {
    const row = await getOwnedMessage(req.address.id, req.params.id);
    res.json({ message: publicMessage(row), quota: await replyQuota(req.address.id) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.delete('/messages/:id', requireAuth, async (req, res) => {
  try {
    res.json(await deleteMessage(req.address.id, req.params.id));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.post('/messages/:id/reply', requireAuth, limit(60, 60_000, 'reply'), async (req, res) => {
  try {
    const result = await sendReply(req.address, {
      messageId: req.params.id,
      body: req.body?.body,
      subject: req.body?.subject,
      sessionId: req.sessionId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, quota: err.quota });
  }
});

api.post('/send', requireAuth, limit(60, 60_000, 'send'), async (req, res) => {
  try {
    const result = await composeSend(req.address, {
      to: req.body?.to,
      subject: req.body?.subject,
      body: req.body?.body,
      sessionId: req.sessionId,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

api.get('/quota', requireAuth, async (req, res) => {
  res.json(await replyQuota(req.address.id));
});

if (config.devInject) {
  api.post('/dev/inject', limit(60, 60_000, 'inject'), async (req, res) => {
    try {
      const { to, from, fromName, subject, body, html } = req.body || {};
      if (!to || !from) {
        return res.status(400).json({ error: 'to and from are required' });
      }
      const saved = await ingestInbound({
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
