const VAULT_KEY = 'ptm.vault.v2';
const ACTIVE_KEY = 'ptm.active.v2';

export function loadVault() {
  try {
    const raw = JSON.parse(localStorage.getItem(VAULT_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function saveVault(items) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(items));
}

export function upsertAddress(entry) {
  const vault = loadVault().filter((x) => x.email !== entry.email);
  vault.unshift({
    id: entry.id,
    email: entry.email,
    domain: entry.domain,
    localPart: entry.localPart,
    accessKey: entry.accessKey || '',
    sessionToken: entry.sessionToken || '',
    createdAt: entry.createdAt || Date.now(),
    isPrimary: Boolean(entry.isPrimary),
  });
  saveVault(vault);
  setActive(entry.email);
  return vault;
}

export function updateSession(email, sessionToken) {
  const vault = loadVault().map((x) => (x.email === email ? { ...x, sessionToken } : x));
  saveVault(vault);
  return vault;
}

export function removeAddress(email) {
  const vault = loadVault().filter((x) => x.email !== email);
  saveVault(vault);
  if (getActive() === email) {
    setActive(vault[0]?.email || '');
  }
  return vault;
}

export function getActive() {
  return localStorage.getItem(ACTIVE_KEY) || loadVault()[0]?.email || '';
}

export function setActive(email) {
  if (email) localStorage.setItem(ACTIVE_KEY, email);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function getEntry(email) {
  return loadVault().find((x) => x.email === email) || null;
}

export function getActiveEntry() {
  return getEntry(getActive()) || loadVault()[0] || null;
}
