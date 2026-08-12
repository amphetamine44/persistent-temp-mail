import { test } from 'node:test';
import assert from 'node:assert/strict';

const BASE = process.env.TEST_BASE || 'http://127.0.0.1:3000';

async function mongoReady() {
  const { data } = await json('/api/health');
  return data.db?.mongodb === 'connected';
}

async function domains() {
  const { status, data } = await json('/api/domains');
  assert.equal(status, 200);
  return data;
}

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
  assert.equal(data.version, '2.0.0');
  assert.equal(data.domains, 4);
  assert.equal(data.replyLimit, null);
  assert.ok(data.db);
  assert.ok(['connected', 'skipped', 'disconnected'].includes(data.db.mongodb));
  if (data.db.mongodb === 'connected') assert.equal(data.ok, true);
});

test('GET /api/domains includes expanded matrix + MX', async () => {
  const data = await domains();
  const names = data.all.map((d) => d.domain);
  assert.equal(data.primary, 'edu.as');
  for (const d of ['edu.as', 'emails', 'steudent.edu.as', 'office.edu']) {
    assert.ok(names.includes(d), `missing ${d}`);
  }
  assert.ok(data.all.every((d) => d.mx && typeof d.priority === 'number'));
  assert.equal(data.all.length, 4);
});

test('SSE stream is deprecated', async () => {
  const res = await fetch(`${BASE}/api/inbox/stream`);
  assert.notEqual(res.status, 200);
});

test('POST /api/addresses creates a persistent mailbox', async (t) => {
  if (!(await mongoReady())) { t.skip('MongoDB not connected'); return; }
  const { primary } = await domains();
  const localPart = `spec.${Date.now()}`;
  const { status, data } = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: primary },
  });
  assert.equal(status, 201);
  assert.equal(data.address.email, `${localPart}@${primary}`);
  assert.ok(data.sessionToken);
});

test('duplicate local-part on same domain is rejected', async (t) => {
  if (!(await mongoReady())) { t.skip('MongoDB not connected'); return; }
  const localPart = `dup.${Date.now()}`;
  const first = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: 'office.edu' },
  });
  assert.equal(first.status, 201);
  const second = await json('/api/addresses', {
    method: 'POST',
    body: { localPart, domain: 'office.edu' },
  });
  assert.equal(second.status, 409);
});

test('login reopens the same address', async (t) => {
  if (!(await mongoReady())) { t.skip('MongoDB not connected'); return; }
  const created = await json('/api/addresses', {
    method: 'POST',
    body: { domain: 'emails' },
  });
  const { email } = created.data.address;
  const login = await json('/api/auth/login', {
    method: 'POST',
    body: { email, accessKey: created.data.accessKey },
  });
  assert.equal(login.status, 200);
  assert.equal(login.data.address.email, email);
});

test('inbox is session-scoped to the authenticated address', async (t) => {
  if (!(await mongoReady())) { t.skip('MongoDB not connected'); return; }
  const { primary, alternatives } = await domains();
  const a = await json('/api/addresses', { method: 'POST', body: { domain: primary } });
  assert.equal(a.status, 201, a.data.error);
  const b = await json('/api/addresses', { method: 'POST', body: { domain: alternatives[0] } });
  assert.equal(b.status, 201, b.data.error);
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
  const subjects = inboxA.data.threads.map((th) => th.subject);
  assert.ok(subjects.includes('only-a'));
  assert.ok(!subjects.includes('only-b'));
  assert.equal(inboxA.data.address.email, a.data.address.email);
  assert.ok(inboxA.data.sessionId);
});

test('replies are unlimited and messages can be purged', async (t) => {
  if (!(await mongoReady())) { t.skip('MongoDB not connected'); return; }
  const created = await json('/api/addresses', { method: 'POST', body: { domain: 'steudent.edu.as' } });
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
  for (let i = 1; i <= 4; i += 1) {
    const r = await json(`/api/messages/${id}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: { body: `reply ${i}` },
    });
    assert.equal(r.status, 201, `reply ${i} should succeed`);
    assert.equal(r.data.quota.unlimited, true);
  }
  const del = await json(`/api/messages/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(del.status, 200);
  assert.equal(del.data.deleted, true);
});

test('GET / serves Arabic landing by default', async () => {
  const res = await fetch(`${BASE}/`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /PersistMail/);
  assert.match(html, /lang="ar"/);
  assert.match(html, /dir="rtl"/);
  assert.match(html, /أنشئ صندوقاً/);
});
