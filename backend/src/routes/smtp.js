import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { config } from '../config.js';
import { ingestInbound } from '../services/mail.js';

function collect(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

export function startSmtp() {
  const server = new SMTPServer({
    disabledCommands: ['AUTH'],
    hideSTARTTLS: true,
    logger: false,
    banner: 'PersistMail v2.0.0 ready',
    size: 5 * 1024 * 1024,
    onRcptTo(address, _session, cb) {
      const domain = String(address.address || '').split('@')[1]?.toLowerCase();
      if (!config.domains.includes(domain)) {
        return cb(Object.assign(new Error('Relay denied'), { responseCode: 550 }));
      }
      cb();
    },
    async onData(stream, session, cb) {
      try {
        const raw = await collect(stream);
        const parsed = await simpleParser(raw);
        const recipients = [
          ...(session.envelope?.rcptTo || []).map((r) => r.address),
          ...[].concat(parsed.to?.value?.map((v) => v.address) || []),
        ].filter(Boolean);

        const unique = [...new Set(recipients.map((e) => e.toLowerCase()))];
        let stored = 0;
        for (const to of unique) {
          try {
            await ingestInbound({
              to,
              from: parsed.from?.text || session.envelope?.mailFrom?.address || 'unknown@unknown',
              fromName: parsed.from?.value?.[0]?.name || '',
              subject: parsed.subject || '',
              bodyText: parsed.text || '',
              bodyHtml: parsed.html || '',
              headers: Object.fromEntries(parsed.headers || []),
            });
            stored += 1;
          } catch {
            /* unknown mailbox */
          }
        }
        if (!stored) {
          return cb(Object.assign(new Error('No such mailbox'), { responseCode: 550 }));
        }
        cb();
      } catch (err) {
        cb(err);
      }
    },
  });

  server.on('error', (err) => {
    console.error('[smtp]', err.message);
  });

  return new Promise((resolve, reject) => {
    server.listen(config.smtpPort, config.host, (err) => {
      if (err) reject(err);
      else {
        console.log(`[smtp] listening on ${config.host}:${config.smtpPort}`);
        resolve(server);
      }
    });
  });
}
