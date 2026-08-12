import { api, copyText, fmtTime, openStream } from './api.js';
import { getActive, getActiveEntry, getEntry, loadVault, setActive, updateSession } from './vault.js';

const $ = (s) => document.querySelector(s);

const state = {
  token: '',
  email: '',
  inbox: null,
  threadId: '',
  thread: null,
  stream: null,
};

function quotaClass(q) {
  if (!q) return '';
  if (q.remaining <= 0) return 'out';
  if (q.remaining === 1) return 'low';
  return '';
}

function paintQuota(q) {
  const el = $('#quota');
  if (!q) { el.textContent = 'replies —'; return; }
  el.textContent = `replies ${q.used}/${q.limit} · ${q.remaining} left / ${q.windowHours}h`;
  el.className = `quota ${quotaClass(q)}`;
  const note = $('#limit-note');
  if (note) {
    note.className = `limit-note ${q.remaining <= 0 ? 'warn' : ''}`;
    note.textContent = q.remaining <= 0
      ? `Limit reached. This address can send 3 replies per 24 hours.${q.resetsAt ? ' Resets ' + fmtTime(q.resetsAt) + '.' : ''}`
      : `${q.remaining} of ${q.limit} replies remaining in the current 24-hour window.`;
  }
  const send = $('#btn-send');
  if (send) send.disabled = q.remaining <= 0;
}

function renderAddresses() {
  const vault = loadVault();
  const box = $('#addr-list');
  box.innerHTML = vault.map((v) => `
    <button class="addr ${v.email === state.email ? 'active' : ''}" data-email="${v.email}" type="button">
      <div class="em">${v.email}</div>
      <div class="sub"><span>${v.domain}</span><span>${v.isPrimary ? 'PRIMARY' : 'FREE'}</span></div>
    </button>
  `).join('') || '<div class="empty">No saved addresses</div>';
  box.querySelectorAll('.addr').forEach((b) => {
    b.onclick = () => switchAddress(b.dataset.email);
  });
}

function renderThreads() {
  const threads = state.inbox?.threads || [];
  const box = $('#thread-list');
  $('#thread-count').textContent = `${threads.length} thread${threads.length === 1 ? '' : 's'}`;
  if (!threads.length) {
    box.innerHTML = '<div class="empty">This inbox is empty. Send mail to this address or inject a test message.</div>';
    return;
  }
  box.innerHTML = threads.map((t) => `
    <button class="thread ${t.threadId === state.threadId ? 'active' : ''}" data-id="${t.threadId}" type="button">
      <div class="sub">${escapeHtml(t.subject)}</div>
      <div class="from">${escapeHtml(t.fromName || t.from)}</div>
      <div class="prev">${escapeHtml(t.preview || '')}</div>
      <div class="meta">
        <span>${fmtTime(t.lastAt)} · ${t.count} msg</span>
        ${t.unread ? `<span class="dot">${t.unread}</span>` : ''}
      </div>
    </button>
  `).join('');
  box.querySelectorAll('.thread').forEach((b) => {
    b.onclick = () => openThread(b.dataset.id);
  });
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderReader() {
  const pane = $('#reader');
  if (!state.thread) {
    pane.innerHTML = `
      <div class="empty">
        <div>
          <div style="font-size:28px;margin-bottom:8px">▣</div>
          Select a thread to read its history.<br>
          Only messages for <b style="color:var(--ink)">${escapeHtml(state.email || 'this address')}</b> are loaded.
        </div>
      </div>`;
    return;
  }
  const msgs = state.thread.messages || [];
  const lastInbound = [...msgs].reverse().find((m) => m.direction === 'inbound') || msgs[msgs.length - 1];
  pane.innerHTML = `
    <div class="col-h" style="position:static;padding:0 0 16px;background:transparent;border:0">
      <h4>Thread</h4>
      <div style="margin-top:8px;font-size:20px;letter-spacing:-0.04em;font-weight:600">${escapeHtml(state.thread.subject)}</div>
    </div>
    ${msgs.map((m) => `
      <article class="msg ${m.direction === 'outbound' ? 'out' : ''}">
        <div class="who">
          <b>${escapeHtml(m.fromName || m.from)} ${m.direction === 'outbound' ? '→ ' + escapeHtml(m.to) : ''}</b>
          <span>${m.direction} · ${fmtTime(m.createdAt)}</span>
        </div>
        <div class="body">${escapeHtml(m.bodyText || '').trim() || '(empty body)'}</div>
      </article>
    `).join('')}
    <form class="composer" id="reply-form">
      <label class="field">
        <span style="display:block;font-size:11px;color:var(--faint);letter-spacing:.08em;text-transform:uppercase;margin-bottom:7px">Reply</span>
        <textarea id="reply-body" placeholder="Write a reply to ${escapeHtml(lastInbound?.from || '')}…"></textarea>
      </label>
      <div class="btn-row">
        <button class="btn btn-lime" id="btn-send" type="submit">Send reply</button>
      </div>
      <p class="limit-note" id="limit-note"></p>
      <p class="flash" id="reply-error"></p>
    </form>
  `;
  paintQuota(state.inbox?.quota);
  $('#reply-form').onsubmit = (e) => {
    e.preventDefault();
    sendReply(lastInbound?.id);
  };
}

async function ensureSession(entry) {
  if (!entry) throw new Error('No address selected');
  if (entry.sessionToken) {
    try {
      await api.me(entry.sessionToken);
      return entry.sessionToken;
    } catch { /* re-login */ }
  }
  if (!entry.accessKey) throw new Error('Missing access key for this address. Sign in from the landing page.');
  const data = await api.login(entry.email, entry.accessKey);
  updateSession(entry.email, data.sessionToken);
  return data.sessionToken;
}

async function loadInbox() {
  const data = await api.inbox(state.token);
  state.inbox = data;
  $('#active-email').textContent = data.address.email;
  paintQuota(data.quota);
  renderThreads();
}

async function openThread(id) {
  state.threadId = id;
  state.thread = await api.thread(state.token, id);
  if (state.inbox) state.inbox.quota = state.thread.quota;
  renderThreads();
  renderReader();
}

async function sendReply(messageId) {
  const err = $('#reply-error');
  err?.classList.remove('show');
  try {
    if (!messageId) throw new Error('No message to reply to');
    const body = $('#reply-body').value;
    const result = await api.reply(state.token, messageId, body);
    if (state.inbox) state.inbox.quota = result.quota;
    $('#reply-body').value = '';
    await openThread(state.threadId);
    await loadInbox();
  } catch (e) {
    if (err) {
      err.textContent = e.message;
      err.classList.add('show');
    }
    if (e.payload?.quota) paintQuota(e.payload.quota);
  }
}

async function switchAddress(email) {
  setActive(email);
  const entry = getEntry(email);
  state.email = email;
  state.threadId = '';
  state.thread = null;
  renderAddresses();
  renderReader();
  try {
    state.token = await ensureSession(entry);
    await loadInbox();
    attachStream();
  } catch (e) {
    $('#thread-list').innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

function attachStream() {
  if (state.stream) {
    state.stream.close();
    state.stream = null;
  }
  state.stream = openStream(state.token, async (type) => {
    if (type === 'message') {
      await loadInbox();
      if (state.threadId) {
        try { await openThread(state.threadId); } catch { /* gone */ }
      }
    }
  });
}

async function injectTest() {
  const from = prompt('From address', 'alice@example.com');
  if (!from) return;
  const subject = prompt('Subject', 'Hello from the outside');
  if (subject === null) return;
  const body = prompt('Body', 'This is a test message delivered to your persistent mailbox.');
  if (body === null) return;
  await api.inject({ to: state.email, from, subject, body });
  await loadInbox();
}

async function boot() {
  const params = new URLSearchParams(location.search);
  const wanted = params.get('addr') || getActive();
  if (wanted) setActive(wanted);
  const entry = getActiveEntry();
  renderAddresses();
  if (!entry) {
    $('#thread-list').innerHTML = '<div class="empty">No addresses in your vault. Generate one on the landing page.</div>';
    return;
  }
  $('#copy-active').onclick = async () => {
    await copyText(state.email);
    $('#copy-active').textContent = 'Copied';
    setTimeout(() => { $('#copy-active').textContent = 'Copy'; }, 1100);
  };
  $('#btn-inject').onclick = injectTest;
  $('#btn-new').onclick = () => { location.href = '/'; };
  await switchAddress(entry.email);
}

boot();
