import crypto from 'node:crypto';

const ADJECTIVES = [
  'silent', 'rapid', 'amber', 'lunar', 'vivid', 'quiet', 'bold', 'crisp',
  'frost', 'nova', 'ember', 'azure', 'ivory', 'cobalt', 'jade', 'onyx',
  'solar', 'velvet', 'brisk', 'copper', 'neon', 'prism', 'shadow', 'tidal',
];

const NOUNS = [
  'otter', 'falcon', 'cedar', 'pixel', 'harbor', 'quartz', 'comet', 'willow',
  'nexus', 'ridge', 'orbit', 'maple', 'cinder', 'haven', 'spark', 'lotus',
  'raven', 'delta', 'atlas', 'ember', 'flint', 'grove', 'lynx', 'mirage',
];

export function randomInt(max) {
  return crypto.randomInt(0, max);
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomAccessKey() {
  const raw = crypto.randomBytes(18).toString('base64url');
  return `ptm_${raw}`;
}

export function randomLocalPart() {
  const a = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const n = NOUNS[randomInt(NOUNS.length)];
  const num = crypto.randomInt(100, 9999);
  return `${a}.${n}${num}`;
}

export function normalizeLocalPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._+-]/g, '')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 64);
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function parseEmail(value) {
  const email = normalizeEmail(value);
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  return {
    local: email.slice(0, at),
    domain: email.slice(at + 1),
    email,
  };
}

export function extractEmail(raw) {
  if (!raw) return '';
  const m = String(raw).match(/<([^>]+)>/);
  return normalizeEmail(m ? m[1] : raw);
}

export function extractName(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  const m = s.match(/^(.*)<[^>]+>$/);
  if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  return '';
}

export function hintKey(key) {
  const s = String(key);
  return s.slice(-4);
}
