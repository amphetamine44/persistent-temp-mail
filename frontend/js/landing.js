import { api, copyText } from './api.js';
import { applyI18n, t, toggleLang } from './i18n.js';
import { loadVault, upsertAddress, removeAddress } from './vault.js';

const $ = (s) => document.querySelector(s);

const state = {
  domains: [],
  selected: '',
  primary: '',
};

function flash(el, msg, ok = false) {
  el.textContent = msg;
  el.classList.toggle('ok', ok);
  el.classList.add('show');
}

function renderDomains() {
  const box = $('#domains');
  box.innerHTML = state.domains.map((d) => `
    <button class="domain ${d.domain === state.selected ? 'active' : ''}" data-domain="${d.domain}" type="button">
      <span class="dn">${d.domain}</span>
      <span class="tag ${d.primary ? 'primary' : ''}">${d.primary ? t('primary') : t('free')} · MX ${d.mx || ''}</span>
    </button>
  `).join('');
  box.querySelectorAll('.domain').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selected = btn.dataset.domain;
      renderDomains();
    });
  });
}

function renderVault() {
  const vault = loadVault();
  const list = $('#vault-list');
  $('#vault-count').textContent = String(vault.length);
  if (!vault.length) {
    list.innerHTML = `<div class="empty" style="min-height:120px">${t('noVault')}</div>`;
    return;
  }
  list.innerHTML = vault.map((v) => `
    <div class="vault-item" data-email="${v.email}">
      <div>
        <div class="em">${v.email}</div>
        <div class="meta">${v.isPrimary ? t('primaryDom') : t('altDom')} · key …${(v.accessKey || '').slice(-4)} · ${new Date(v.createdAt).toLocaleString()}</div>
      </div>
      <div class="btn-row">
        <button class="btn btn-lime" data-act="open">${t('open')}</button>
        <button class="btn btn-ghost" data-act="copy">${t('copy')}</button>
        <button class="btn btn-danger" data-act="forget">${t('forget')}</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.vault-item').forEach((row) => {
    const email = row.dataset.email;
    row.querySelector('[data-act="open"]').onclick = () => {
      location.href = `/inbox.html?addr=${encodeURIComponent(email)}`;
    };
    row.querySelector('[data-act="copy"]').onclick = async () => {
      await copyText(email);
      row.querySelector('[data-act="copy"]').textContent = t('copied');
      setTimeout(() => { row.querySelector('[data-act="copy"]').textContent = t('copy'); }, 1200);
    };
    row.querySelector('[data-act="forget"]').onclick = () => {
      removeAddress(email);
      renderVault();
    };
  });
}

async function generate() {
  const err = $('#gen-error');
  err.classList.remove('show');
  const btn = $('#btn-gen');
  btn.disabled = true;
  try {
    const localPart = $('#local-part').value.trim();
    const data = await api.create({ localPart: localPart || undefined, domain: state.selected });
    upsertAddress({
      ...data.address,
      accessKey: data.accessKey,
      sessionToken: data.sessionToken,
    });
    $('#issued').classList.add('show');
    $('#issued-email').textContent = data.address.email;
    $('#issued-key').textContent = data.accessKey;
    flash(err, t('reserved'), true);
    renderVault();
    $('#local-part').value = '';
  } catch (e) {
    flash(err, e.message);
  } finally {
    btn.disabled = false;
  }
}

async function login(e) {
  e.preventDefault();
  const err = $('#login-error');
  err.classList.remove('show');
  try {
    const email = $('#login-email').value.trim();
    const accessKey = $('#login-key').value.trim();
    const data = await api.login(email, accessKey);
    upsertAddress({
      ...data.address,
      accessKey,
      sessionToken: data.sessionToken,
    });
    location.href = `/inbox.html?addr=${encodeURIComponent(data.address.email)}`;
  } catch (ex) {
    flash(err, ex.message);
  }
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((tbtn) => tbtn.classList.toggle('active', tbtn.dataset.tab === name));
  $('#panel-generate').style.display = name === 'generate' ? 'block' : 'none';
  $('#panel-login').style.display = name === 'login' ? 'block' : 'none';
}

async function boot() {
  applyI18n();
  renderVault();
  $('#lang-toggle')?.addEventListener('click', () => {
    toggleLang();
    $('#lang-toggle').textContent = t('lang');
    renderDomains();
    renderVault();
  });
  try {
    const d = await api.domains();
    state.domains = d.all;
    state.primary = d.primary;
    state.selected = d.primary;
    renderDomains();
    $('#stat-domains').textContent = String(d.all.length);
    const mirror = $('#domain-mirror');
    if (mirror) mirror.value = d.primary;
  } catch {
    $('#domains').innerHTML = `<p class="hint">${t('apiDown')}</p>`;
  }
  try {
    const h = await api.health();
    $('#stat-ver').textContent = h.version;
  } catch { /* offline */ }

  $('#btn-gen').addEventListener('click', generate);
  $('#btn-random').addEventListener('click', () => {
    $('#local-part').value = '';
    generate();
  });
  $('#login-form').addEventListener('submit', login);
  document.querySelectorAll('.tab').forEach((tb) => tb.addEventListener('click', () => switchTab(tb.dataset.tab)));
  $('#copy-email').addEventListener('click', async () => {
    await copyText($('#issued-email').textContent);
    $('#copy-email').textContent = t('copied');
    setTimeout(() => { $('#copy-email').textContent = t('copyAddr'); }, 1200);
  });
  $('#copy-key').addEventListener('click', async () => {
    await copyText($('#issued-key').textContent);
    $('#copy-key').textContent = t('copied');
    setTimeout(() => { $('#copy-key').textContent = t('copyKey'); }, 1200);
  });
  $('#open-inbox').addEventListener('click', () => {
    const email = $('#issued-email').textContent;
    location.href = `/inbox.html?addr=${encodeURIComponent(email)}`;
  });
  $('#domains').addEventListener('click', () => {
    const active = document.querySelector('.domain.active .dn');
    const mirror = $('#domain-mirror');
    if (active && mirror) mirror.value = active.textContent;
  });
}

boot();
