import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const primary = env('PRIMARY_DOMAIN', 'persistmail.io').toLowerCase().trim();
const alt = env('ALT_DOMAINS', 'inboxdrop.net,tempkeep.org,mailstash.cc,openbox.email,ghostletter.dev')
  .split(',')
  .map((d) => d.toLowerCase().trim())
  .filter(Boolean)
  .filter((d) => d !== primary);

export const config = {
  root: ROOT,
  port: Number(env('PORT', '3000')),
  smtpPort: Number(env('SMTP_PORT', '2525')),
  host: env('HOST', '0.0.0.0'),
  primaryDomain: primary,
  altDomains: alt,
  domains: [primary, ...alt],
  sessionTtlMs: Number(env('SESSION_TTL_HOURS', '720')) * 60 * 60 * 1000,
  replyLimit: Number(env('REPLY_LIMIT', '3')),
  replyWindowMs: Number(env('REPLY_WINDOW_HOURS', '24')) * 60 * 60 * 1000,
  devInject: env('DEV_INJECT', '1') === '1',
  frontendDir: path.resolve(ROOT, 'frontend'),
};

export function isManagedDomain(domain) {
  return config.domains.includes(String(domain || '').toLowerCase());
}
