# PersistMail v2.0.0

Persistent temporary email. Addresses are reserved server-side, reusable across platforms, and each mailbox is isolated to the authenticated session.

```
npm install
npm start
```

- HTTP  http://0.0.0.0:3000
- SMTP  0.0.0.0:2525  (accepts mail for configured domains)

## Layout

```
backend/     Express API + SMTP ingest + Mongoose
frontend/    Landing + three-pane inbox (AR default)
```

## Rules

- Unlimited address generation on `edu.as`, `emails`, `steudent.edu.as`, `office.edu`.
- Login = `email + access key` (key shown once at creation, stored hashed).
- Inbox queries are scoped to the current session's mailbox (`address_id`).
- Outbound send/reply is unlimited. Individual messages can be deleted.
- Live updates use `/api/inbox/poll` (SSE removed for Vercel).

## Config

| key | default |
|---|---|
| `PRIMARY_DOMAIN` | edu.as |
| `ALT_DOMAINS` | emails,steudent.edu.as,office.edu |
| `PORT` | 3000 |
| `SMTP_PORT` | 2525 |
| `REPLY_LIMIT` | empty / unlimited |
| `MONGODB_URI` | required for persistence |
