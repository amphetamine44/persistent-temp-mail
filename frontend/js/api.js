async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export const api = {
  health: () => request('/api/health'),
  domains: () => request('/api/domains'),
  create: (payload) => request('/api/addresses', { method: 'POST', body: payload }),
  login: (email, accessKey) => request('/api/auth/login', { method: 'POST', body: { email, accessKey } }),
  logout: (token) => request('/api/auth/logout', { method: 'POST', token }),
  me: (token) => request('/api/me', { token }),
  inbox: (token) => request('/api/inbox', { token }),
  thread: (token, id) => request(`/api/threads/${id}`, { token }),
  reply: (token, messageId, body, subject) =>
    request(`/api/messages/${messageId}/reply`, { method: 'POST', token, body: { body, subject } }),
  send: (token, payload) => request('/api/send', { method: 'POST', token, body: payload }),
  remove: (token, id) => request(`/api/messages/${id}`, { method: 'DELETE', token }),
  quota: (token) => request('/api/quota', { token }),
  inject: (payload) => request('/api/dev/inject', { method: 'POST', body: payload }),
  poll: (token, since) => request(`/api/inbox/poll?since=${since}`, { token }),
};

export function startPoll(fn, intervalMs = 4000) {
  let stopped = false;
  let timer = null;
  const tick = async () => {
    if (stopped) return;
    try { await fn(); } catch { /* next tick */ }
    if (!stopped) timer = setTimeout(tick, intervalMs);
  };
  tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}

export function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const same = new Date().toDateString() === d.toDateString();
  return same
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
    return true;
  }
}
