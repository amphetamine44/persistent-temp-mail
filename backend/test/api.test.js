import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000';

async function json(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

test('GET /api/health', async () => {
  const { status, data } = await json('/api/health');
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.version, '2.0.0');
  assert.equal(data.domains, 6);
});

test('GET /api/domains exposes primary + free alternatives', async () => {
  const { status, data } = await json('/api/domains');
  assert.equal(status, 200);
  assert.equal(data.primary, 'persistmail.io');
  assert.ok(data.alternatives.includes('ghostletter.dev'));
  assert.equal(data.all.length, 6);
});

test('POST /api/addresses creates a persistent mailbox', async () => {
  const localPart = `spec.${Date.now()}`;
  const { status, data } = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: 'persistmail.io' },
  });
  assert.equal(status, 201);
  assert.equal(data.address.email, `${localPart}@persistmail.io`);
  assert.match(data.accessKey, /^ptm_/);
  assert.ok(data.sessionToken);
});

test('duplicate local-part on same domain is rejected', async () => {
  const localPart = `dup.${Date.now()}`;
  const first = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: 'tempkeep.org' },
  });
  assert.equal(first.status, 201);
  const second = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: 'tempkeep.org' },
  });
  assert.equal(second.status, 409);
});

test('login reopens the same address', async () => {
  const created = await json('/api/addresses', {
    method: 'POST',
    body: { domain: 'openbox.email' },
  });
  const { email } = created.data.address;
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: { email, accessKey: created.data.accessKey },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.address.email, email);
});

test('inbox returns only the authenticated address threads', async () => {
  const a = await json('/api/addresses', { method: 'POST', body: { domain: 'persistmail.io' } });
  const b = await json('/api/addresses', { method: 'POST', body: { domain: 'inboxdrop.net' } });
  await json('/api/dev/inject', {
    method: 'POST',
    body: { to: a.data.address.email, from: 'x@y.z', subject: 'only-a', body: 'secret-a' },
  });
  await json('/api/dev/inject', {
    method: 'POST',
    body: { to: b.data.address.email, from: 'x@y.z', subject: 'only-b', body: 'secret-b' },
  });
  const inboxA = await json('/api/inbox', {
    headers: { Authorization: `Bearer ${a.data.sessionToken}` },
  });
  const subjects = inboxA.data.threads.map((t) => t.subject);
  assert.ok(subjects.includes('only-a'));
  assert.ok(!subjects.includes('only-b'));
  assert.equal(inboxA.data.address.email, a.data.address.email);
});

test('reply limit is 3 per 24 hours', async () => {
  const created = await json('/api/addresses', { method: 'POST', body: { domain: 'mailstash.cc' } });
  const token = created.data.sessionToken;
  const injected = await json('/api/dev/inject', {
    method: 'POST',
    body: {
      to: created.data.address.email,
      from: 'peer@example.com',
      subject: 'quota',
      body: 'ping',
    },
  });
  const id = injected.data.message.id;
  for (let i = 1; i <= 3; i += 1) {
    const r = await json(`/api/messages/${id}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { body: `reply ${i}` },
    });
    assert.equal(r.status, 201, `reply ${i} should succeed`);
    assert.equal(r.data.quota.used, i);
  }
  const blocked = await json(`/api/messages/${id}/reply`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: { body: 'reply 4' },
  });
  assert.equal(blocked.status, 429);
  assert.equal(blocked.data.quota.remaining, 0);
});

test('GET / serves landing page', async () => {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /PersistMail/);
  assert.match(html, /Create a reusable mailbox/);
});
