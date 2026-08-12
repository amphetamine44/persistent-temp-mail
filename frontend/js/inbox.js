import { api, copyText, fmtTime, startPoll } from './api.js';
import { applyI18n, t, toggleLang } from './i18n.js';
import { getActive, getActiveEntry, getEntry, loadVault, setActive, updateSession } from './vault.js';

const $ = (s) => document.querySelector(s);

const state = {
  token: '',
  email: '',
  inbox: null,
  threadId: '',
  thread: null,
  composing: false,
  stopPoll: null,
  since: 0,
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderAddresses() {
  const vault = loadVault();
  const box = $('#addr-list');
  box.innerHTML = vault.map((v) => `
    <button class="addr ${v.email === state.email ? 'active' : ''}" data-email="${v.email}" type="button">
      <div class="em">${v.email}</div>
      <div class="sub"><span>${v.domain}</span><span>${v.isPrimary ? t('primary') : t('free')}</span></div>
    </button>
  `).join('') || `<div class="empty">${t('noAddr')}</div>`;
  box.querySelectorAll('.addr').forEach((b) => {
    b.onclick = () => switchAddress(b.dataset.email);
  });
}

function renderThreads() {
  const threads = state.inbox?.threads || [];
  const box = $('#thread-list');
  $('#thread-count').textContent = `${threads.length} ${t('threads')}`;
  if (!threads.length) {
    box.innerHTML = `<div class="empty">${t('emptyInbox')}</div>`;
    return;
  }
  box.innerHTML = threads.map((th) => `
    <button class="thread ${th.threadId === state.threadId ? 'active' : ''}" data-id="${th.threadId}" type="button">
      <div class="sub">${escapeHtml(th.subject)}</div>
      <div class="from">${escapeHtml(th.fromName || th.from)}</div>
      <div class="prev">${escapeHtml(th.preview || '')}</div>
      <div class="meta">
        <span>${fmtTime(th.lastAt)} · ${th.count}</span>
        ${th.unread ? `<span class="dot">${th.unread}</span>` : ''}
      </div>
    </button>
  `).join('');
  box.querySelectorAll('.thread').forEach((b) => {
    b.onclick = () => {
      state.composing = false;
      openThread(b.dataset.id);
    };
  });
}

function renderCompose() {
  const pane = $('#reader');
  pane.innerHTML = `
    <div class="col-h" style="position:static;padding:0 0 16px;background:transparent;border:0">
      <h4>${t('compose')}</h4>
    </div>
    <form class="composer" id="compose-form">
      <label class="field"><span class="lbl">${t('to')}</span>
        <input id="compose-to" type="email" required placeholder="name@domain.tld" />
      </label>
      <label class="field"><span class="lbl">${t('subject')}</span>
        <input id="compose-subject" type="text" />
      </label>
      <label class="field"><span class="lbl">${t('body')}</span>
        <textarea id="compose-body" required></textarea>
      </label>
      <div class="btn-row">
        <button class="btn btn-lime" type="submit">${t('send')}</button>
      </div>
      <p class="flash" id="compose-error"></p>
    </form>
  `;
  $('#compose-form').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#compose-error');
    err.classList.remove('show');
    try {
      await api.send(state.token, {
        to: $('#compose-to').value,
        subject: $('#compose-subject').value,
        body: $('#compose-body').value,
      });
      state.composing = false;
      await loadInbox();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.add('show');
    }
  };
}

function renderReader() {
  const pane = $('#reader');
  if (state.composing) {
    renderCompose();
    return;
  }
  if (!state.thread) {
    pane.innerHTML = `
      <div class="empty">
        <div>
          <div style="font-size:28px;margin-bottom:8px">▣</div>
          ${t('selectThread')}<br>
          ${t('onlyThis')} <b style="color:var(--ink)">${escapeHtml(state.email || '')}</b>
        </div>
      </div>`;
    return;
  }
  const msgs = state.thread.messages || [];
  const lastInbound = [...msgs].reverse().find((m) => m.direction === 'inbound') || msgs[msgs.length - 1];
  pane.innerHTML = `
    <div class="col-h" style="position:static;padding:0 0 16px;background:transparent;border:0">
      <h4>${t('thread')}</h4>
      <div style="margin-top:8px;font-size:20px;letter-spacing:-0.04em;font-weight:600">${escapeHtml(state.thread.subject)}</div>
    </div>
    ${msgs.map((m) => `
      <article class="msg ${m.direction === 'outbound' ? 'out' : ''}" data-mid="${m.id}">
        <div class="who">
          <b>${escapeHtml(m.fromName || m.from)} ${m.direction === 'outbound' ? '→ ' + escapeHtml(m.to) : ''}</b>
          <span>${t(m.direction)} · ${fmtTime(m.createdAt)}</span>
        </div>
        <div class="body">${escapeHtml(m.bodyText || '').trim() || t('emptyBody')}</div>
        <div class="btn-row" style="margin-top:10px">
          <button class="btn btn-danger" data-del="${m.id}" type="button" style="padding:7px 10px;font-size:12px">${t('delete')}</button>
        </div>
      </article>
    `).join('')}
    <form class="composer" id="reply-form">
      <label class="field">
        <span class="lbl">${t('reply')}</span>
        <textarea id="reply-body" placeholder="${t('writeReply')} ${escapeHtml(lastInbound?.from || '')}…"></textarea>
      </label>
      <div class="btn-row">
        <button class="btn btn-lime" id="btn-send" type="submit">${t('sendReply')}</button>
      </div>
      <p class="flash" id="reply-error"></p>
    </form>
  `;
  pane.querySelectorAll('[data-del]').forEach((btn) => {
    btn.onclick = () => purgeMessage(btn.getAttribute('data-del'));
  });
  $('#reply-form').onsubmit = (e) => {
    e.preventDefault();
    sendReply(lastInbound?.id);
  };
}

async function ensureSession(entry) {
  if (!entry) throw new Error(t('noAddr'));
  if (entry.sessionToken) {
    try {
      await api.me(entry.sessionToken);
      return entry.sessionToken;
    } catch { /* re-login */ }
  }
  if (!entry.accessKey) throw new Error(t('noAddr'));
  const data = await api.login(entry.email, entry.accessKey);
  updateSession(entry.email, data.sessionToken);
  return data.sessionToken;
}

async function loadInbox() {
  const data = await api.inbox(state.token);
  state.inbox = data;
  state.since = Date.now();
  $('#active-email').textContent = data.address.email;
  $('#quota').textContent = t('unlimited');
  renderThreads();
  if (state.threadId) {
    const still = (data.threads || []).some((th) => th.threadId === state.threadId);
    if (!still) {
      state.threadId = '';
      state.thread = null;
      renderReader();
    }
  }
}

async function openThread(id) {
  state.threadId = id;
  state.thread = await api.thread(state.token, id);
  renderThreads();
  renderReader();
}

async function sendReply(messageId) {
  const err = $('#reply-error');
  err?.classList.remove('show');
  try {
    if (!messageId) throw new Error(t('emptyInbox'));
    const body = $('#reply-body').value;
    await api.reply(state.token, messageId, body);
    $('#reply-body').value = '';
    await openThread(state.threadId);
    await loadInbox();
  } catch (e) {
    if (err) {
      err.textContent = e.message;
      err.classList.add('show');
    }
  }
}

async function purgeMessage(id) {
  try {
    await api.remove(state.token, id);
    if (state.threadId) {
      try { await openThread(state.threadId); } catch {
        state.threadId = '';
        state.thread = null;
      }
    }
    await loadInbox();
    renderReader();
  } catch (e) {
    const err = $('#reply-error');
    if (err) {
      err.textContent = e.message;
      err.classList.add('show');
    }
  }
}

async function switchAddress(email) {
  setActive(email);
  const entry = getEntry(email);
  state.email = email;
  state.threadId = '';
  state.thread = null;
  state.composing = false;
  renderAddresses();
  renderReader();
  try {
    state.token = await ensureSession(entry);
    await loadInbox();
    attachPoll();
  } catch (e) {
    $('#thread-list').innerHTML = `<div class="empty">${escapeHtml(e.message)}</div>`;
  }
}

function attachPoll() {
  if (state.stopPoll) state.stopPoll();
  state.stopPoll = startPoll(async () => {
    if (!state.token) return;
    const data = await api.poll(state.token, state.since);
    if (data.messages?.length) {
      await loadInbox();
      if (state.threadId && !state.composing) {
        try { await openThread(state.threadId); } catch { /* gone */ }
      }
    }
  }, 4000);
}

async function injectTest() {
  const from = prompt(t('to'), 'alice@example.com');
  if (!from) return;
  const subject = prompt(t('subject'), 'Hello');
  if (subject === null) return;
  const body = prompt(t('body'), 'test');
  if (body === null) return;
  await api.inject({ to: state.email, from, subject, body });
  await loadInbox();
}

async function boot() {
  applyI18n();
  $('#lang-toggle')?.addEventListener('click', () => {
    toggleLang();
    $('#lang-toggle').textContent = t('lang');
    renderAddresses();
    renderThreads();
    renderReader();
    $('#quota').textContent = t('unlimited');
    $('#btn-compose').textContent = t('compose');
    $('#btn-inject').textContent = t('receive');
    $('#btn-new').textContent = t('newAddr');
    $('#copy-active').textContent = t('copy');
  });
  const params = new URLSearchParams(location.search);
  const wanted = params.get('addr') || getActive();
  if (wanted) setActive(wanted);
  const entry = getActiveEntry();
  renderAddresses();
  if (!entry) {
    $('#thread-list').innerHTML = `<div class="empty">${t('noAddr')}</div>`;
    return;
  }
  $('#copy-active').onclick = async () => {
    await copyText(state.email);
    $('#copy-active').textContent = t('copied');
    setTimeout(() => { $('#copy-active').textContent = t('copy'); }, 1100);
  };
  $('#btn-inject').onclick = injectTest;
  $('#btn-new').onclick = () => { location.href = '/'; };
  $('#btn-compose').onclick = () => {
    state.composing = true;
    state.threadId = '';
    renderThreads();
    renderReader();
  };
  await switchAddress(entry.email);
}

boot();
