import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './src/config.js';
import { api } from './src/routes/api.js';
import { startSmtp } from './src/routes/smtp.js';
import connectDB from './src/db/connectDB.js';

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  res.setHeader('X-Service', 'PersistMail/2.0.0');
  next();
});

app.use('/api', api);
app.use(express.static(config.frontendDir, {
  extensions: ['html'],
  etag: true,
  maxAge: 0,
}));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(config.frontendDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[http]', err);
  res.status(err.status || 500).json({ error: err.message || 'Internal error' });
});

await connectDB();

if (!isServerless) {
  const server = app.listen(config.port, config.host, () => {
    console.log(`[http] PersistMail v2.0.0  http://${config.host}:${config.port}`);
    console.log(`[http] primary domain      ${config.primaryDomain}`);
    console.log(`[http] alt domains         ${config.altDomains.join(', ')}`);
    console.log(`[http] database            mongoose ${process.env.MONGODB_URI ? 'configured' : 'not configured'}`);
  });

  startSmtp().catch((err) => {
    console.error('[smtp] failed to bind:', err.message);
  });

  function shutdown(sig) {
    console.log(`[sys] ${sig} — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  }

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
