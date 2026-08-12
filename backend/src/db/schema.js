export const SCHEMA = `
CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  local_part TEXT NOT NULL,
  domain TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  access_key_hash TEXT NOT NULL,
  access_key_hint TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_access INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_addresses_email ON addresses(email);
CREATE INDEX IF NOT EXISTS idx_addresses_domain ON addresses(domain);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  address_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_address ON sessions(address_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL,
  thread_id TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_addr TEXT NOT NULL,
  from_name TEXT,
  to_addr TEXT NOT NULL,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  headers_json TEXT,
  in_reply_to TEXT,
  created_at INTEGER NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_address ON messages(address_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_in_reply ON messages(in_reply_to);

CREATE TABLE IF NOT EXISTS reply_log (
  id TEXT PRIMARY KEY,
  address_id TEXT NOT NULL,
  message_id TEXT,
  sent_at INTEGER NOT NULL,
  FOREIGN KEY (address_id) REFERENCES addresses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reply_log_window ON reply_log(address_id, sent_at);
`;
