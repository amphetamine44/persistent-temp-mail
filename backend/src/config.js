import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ALTS, DEFAULT_PRIMARY, DOMAIN_MATRIX, domainRecord } from './config/domains.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../');

function env(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

const primary = env('PRIMARY_DOMAIN', DEFAULT_PRIMARY).toLowerCase().trim();
const alt = env('ALT_DOMAINS', DEFAULT_ALTS.join(','))
  .split(',')
  .map((d) => d.toLowerCase().trim())
  .filter(Boolean)
  .filter((d) => d !== primary);

const replyRaw = process.env.REPLY_LIMIT;
const replyLimit = replyRaw === undefined || replyRaw === '' || replyRaw === 'null'
  ? null
  : Number(replyRaw);

export const config = {
  root: ROOT,
  port: Number(env('PORT', '3000')),
  smtpPort: Number(env('SMTP_PORT', '2525')),
  host: env('HOST', '0.0.0.0'),
  primaryDomain: primary,
  altDomains: alt,
  domains: [primary, ...alt],
  domainMatrix: DOMAIN_MATRIX,
  sessionTtlMs: Number(env('SESSION_TTL_HOURS', '720')) * 60 * 60 * 1000,
  replyLimit: Number.isFinite(replyLimit) && replyLimit > 0 ? replyLimit : null,
  replyWindowMs: Number(env('REPLY_WINDOW_HOURS', '24')) * 60 * 60 * 1000,
  devInject: env('DEV_INJECT', '1') === '1',
  frontendDir: path.resolve(ROOT, 'frontend'),
  smtpOut: {
    host: env('SMTP_OUT_HOST', ''),
    port: Number(env('SMTP_OUT_PORT', '587')),
    user: env('SMTP_OUT_USER', ''),
    pass: env('SMTP_OUT_PASS', ''),
  },
  mailIpv4: env('MAIL_IPV4', 'YOUR_SERVER_IPV4'),
};

export function isManagedDomain(domain) {
  return config.domains.includes(String(domain || '').toLowerCase());
}

export function mxFor(domain) {
  return domainRecord(domain);
}
