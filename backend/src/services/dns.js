import { DOMAIN_MATRIX, domainRecord } from '../config/domains.js';
import { config } from '../config.js';

function ipv4() {
  return process.env.MAIL_IPV4 || process.env.MX_A || 'YOUR_SERVER_IPV4';
}

export function recordsFor(domain) {
  const rec = domainRecord(domain);
  if (!rec) return null;
  const host = rec.mx || `mx.${rec.domain}`;
  const ttl = rec.ttl || 3600;
  const pri = rec.priority || 10;
  const ip = ipv4();
  const rows = [
    { type: 'MX', name: '@', host: rec.domain, value: host, priority: pri, ttl },
    { type: 'A', name: host.replace(`.${rec.domain}`, '').replace(`.${config.primaryDomain}`, '') || 'mx', host, value: ip, ttl },
    { type: 'TXT', name: '@', host: rec.domain, value: `v=spf1 mx a:${host} ~all`, ttl },
    { type: 'TXT', name: '_dmarc', host: `_dmarc.${rec.domain}`, value: `v=DMARC1; p=none; rua=mailto:postmaster@${rec.domain}`, ttl },
  ];
  return {
    domain: rec.domain,
    primary: rec.primary,
    mx: host,
    priority: pri,
    ttl,
    ipv4: ip,
    inboundPort: 25,
    localSmtpPort: config.smtpPort,
    rows,
  };
}

export function bindZone(domain) {
  const pack = recordsFor(domain);
  if (!pack) return null;
  const lines = [
    `; PersistMail DNS — ${pack.domain}`,
    `; Paste into your registrar / BIND / Cloudflare (DNS-only, grey cloud for MX/A mail host)`,
    `$ORIGIN ${pack.domain}.`,
    `$TTL ${pack.ttl}`,
    `@        IN  MX  ${pack.priority}  ${pack.mx}.`,
    `mx       IN  A   ${pack.ipv4}`,
    `@        IN  TXT "v=spf1 mx a:${pack.mx} ~all"`,
    `_dmarc   IN  TXT "v=DMARC1; p=none; rua=mailto:postmaster@${pack.domain}"`,
    '',
    `; Production inbound SMTP must listen on :25 on ${pack.mx} (${pack.ipv4})`,
    `; Local/dev SMTP remains :${pack.localSmtpPort}`,
  ];
  return lines.join('\n') + '\n';
}

export function registrarTable(domain) {
  const pack = recordsFor(domain);
  if (!pack) return null;
  const header = 'Type\tName\tPriority\tContent\tTTL';
  const lines = pack.rows.map((r) => {
    const name = r.type === 'MX' ? '@' : (r.name || '@');
    const pri = r.type === 'MX' ? String(r.priority) : '';
    return `${r.type}\t${name}\t${pri}\t${r.value}\t${r.ttl}`;
  });
  return [header, ...lines].join('\n') + '\n';
}

export function allZones() {
  return DOMAIN_MATRIX.map((d) => ({
    ...recordsFor(d.domain),
    bind: bindZone(d.domain),
    paste: registrarTable(d.domain),
  }));
}
