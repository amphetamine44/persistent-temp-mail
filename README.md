# PersistMail v2.0.0

Persistent temporary email. Addresses are reserved server-side, reusable across platforms, and each mailbox is isolated.

```
npm install
npm start
```

- HTTP  http://0.0.0.0:3000
- SMTP  0.0.0.0:2525  (accepts mail for configured domains)

## Layout

```
backend/     Express API + SMTP ingest + Mongoose
frontend/    Landing + three-pane inbox
```

## Rules

- Unlimited address generation on the primary domain or any free alternative.
- Login = `email + access key` (key shown once at creation, stored hashed).
- Opening an address loads only that address's threads.
- Outbound replies: **3 per 24 hours per address** (hard backend limit).

## Config

Copy `.env.example` values into the environment. Defaults:

| key | default |
|---|---|
| `PRIMARY_DOMAIN` | persistmail.edu.as |
| `ALT_DOMAINS` | inboxdrop.net,tempkeep.org,mailstash.cc,openbox.email,ghostletter.dev |
| `PORT` | 3000 |
| `SMTP_PORT` | 2525 |
| `REPLY_LIMIT` | 3 |

## Dev inject

```
curl -s -X POST http://127.0.0.1:3000/api/dev/inject \
  -H 'content-type: application/json' \
  -d '{"to":"you@persistmail.io","from":"a@b.co","subject":"hi","body":"hello"}'
```
