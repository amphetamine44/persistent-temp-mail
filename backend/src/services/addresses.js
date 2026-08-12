import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { db, now } from '../db/index.js';
import { config, isManagedDomain } from '../config.js';
import {
  hintKey,
  normalizeEmail,
  normalizeLocalPart,
  parseEmail,
  randomAccessKey,
  randomLocalPart,
  randomToken,
} from '../utils/generate.js';
import { insertWelcome } from './mail.js'; // called after module init — ESM live bindings

const getAddressByEmail = db.prepare('SELECT * FROM addresses WHERE email = ?');
const getAddressById = db.prepare('SELECT * FROM addresses WHERE id = ?');
const insertAddress = db.prepare(`
  INSERT INTO addresses (id, local_part, domain, email, access_key_hash, access_key_hint, created_at, last_access, is_active)
  VALUES (@id, @local_part, @domain, @email, @access_key_hash, @access_key_hint, @created_at, @last_access, 1)
`);
const touchAddress = db.prepare('UPDATE addresses SET last_access = ? WHERE id = ?');
const insertSession = db.prepare(`
  INSERT INTO sessions (token, address_id, created_at, expires_at)
  VALUES (?, ?, ?, ?)
`);
const getSession = db.prepare(`
  SELECT s.token, s.address_id, s.expires_at, a.*
  FROM sessions s
  JOIN addresses a ON a.id = s.address_id
  WHERE s.token = ?
`);
const deleteExpired = db.prepare('DELETE FROM sessions WHERE expires_at < ?');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token = ?');

export function publicAddress(row, extras = {}) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    localPart: row.local_part,
    domain: row.domain,
    isPrimary: row.domain === config.primaryDomain,
    accessKeyHint: row.access_key_hint,
    createdAt: row.created_at,
    lastAccess: row.last_access,
    isActive: Boolean(row.is_active),
    ...extras,
  };
}

export function createAddress({ localPart, domain } = {}) {
  const chosenDomain = String(domain || config.primaryDomain).toLowerCase().trim();
  if (!isManagedDomain(chosenDomain)) {
    const err = new Error('Domain is not available on this service');
    err.status = 400;
    throw err;
  }

  let local = normalizeLocalPart(localPart);
  if (localPart && !local) {
    const err = new Error('Invalid local-part. Use letters, numbers, dots, plus, underscore, or hyphen.');
    err.status = 400;
    throw err;
  }

  if (!local) {
    for (let i = 0; i < 12; i += 1) {
      local = randomLocalPart();
      if (!getAddressByEmail.get(`${local}@${chosenDomain}`)) break;
    }
  }

  const email = `${local}@${chosenDomain}`;
  if (getAddressByEmail.get(email)) {
    const err = new Error('That address is already taken. Choose another local-part or generate a random one.');
    err.status = 409;
    throw err;
  }

  const accessKey = randomAccessKey();
  const id = uuid();
  const ts = now();

  insertAddress.run({
    id,
    local_part: local,
    domain: chosenDomain,
    email,
    access_key_hash: bcrypt.hashSync(accessKey, 10),
    access_key_hint: hintKey(accessKey),
    created_at: ts,
    last_access: ts,
  });

  insertWelcome(id, email);
  const session = issueSession(id);

  return {
    address: publicAddress(getAddressById.get(id), { accessKey, sessionToken: session.token }),
    accessKey,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export function loginAddress(email, accessKey) {
  const parsed = parseEmail(email);
  if (!parsed) {
    const err = new Error('Enter a valid email address');
    err.status = 400;
    throw err;
  }
  const row = getAddressByEmail.get(parsed.email);
  if (!row || !row.is_active) {
    const err = new Error('Address not found or access key is incorrect');
    err.status = 401;
    throw err;
  }
  if (!accessKey || !bcrypt.compareSync(String(accessKey), row.access_key_hash)) {
    const err = new Error('Address not found or access key is incorrect');
    err.status = 401;
    throw err;
  }
  touchAddress.run(now(), row.id);
  const session = issueSession(row.id);
  return {
    address: publicAddress(row, { sessionToken: session.token }),
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export function issueSession(addressId) {
  deleteExpired.run(now());
  const token = randomToken(32);
  const created = now();
  const expiresAt = created + config.sessionTtlMs;
  insertSession.run(token, addressId, created, expiresAt);
  return { token, expiresAt };
}

export function resolveSession(token) {
  if (!token) return null;
  deleteExpired.run(now());
  const row = getSession.get(token);
  if (!row || row.expires_at < now() || !row.is_active) return null;
  touchAddress.run(now(), row.address_id);
  return row;
}

export function logoutSession(token) {
  if (token) deleteSession.run(token);
}

export function findAddressByEmail(email) {
  return getAddressByEmail.get(normalizeEmail(email));
}

export function getAddress(id) {
  return getAddressById.get(id);
}

export function listDomains() {
  return {
    primary: config.primaryDomain,
    alternatives: config.altDomains,
    all: config.domains.map((domain) => ({
      domain,
      primary: domain === config.primaryDomain,
      type: domain === config.primaryDomain ? 'primary' : 'free',
      label: domain === config.primaryDomain ? 'Primary' : 'Free alternative',
    })),
  };
}
