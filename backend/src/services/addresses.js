import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { Address, Session, now, toRow } from '../db/index.js';
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
import { insertWelcome } from './mail.js';

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

export async function createAddress({ localPart, domain } = {}) {
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
      const clash = await Address.findOne({ email: `${local}@${chosenDomain}` }).lean();
      if (!clash) break;
    }
  }

  const email = `${local}@${chosenDomain}`;
  if (await Address.findOne({ email }).lean()) {
    const err = new Error('That address is already taken. Choose another local-part or generate a random one.');
    err.status = 409;
    throw err;
  }

  const accessKey = randomAccessKey();
  const id = uuid();
  const ts = now();

  try {
    await Address.create({
      _id: id,
      local_part: local,
      domain: chosenDomain,
      email,
      access_key_hash: bcrypt.hashSync(accessKey, 10),
      access_key_hint: hintKey(accessKey),
      created_at: ts,
      last_access: ts,
      is_active: true,
    });
  } catch (e) {
    if (e?.code === 11000) {
      const err = new Error('That address is already taken. Choose another local-part or generate a random one.');
      err.status = 409;
      throw err;
    }
    throw e;
  }

  await insertWelcome(id, email);
  const session = await issueSession(id);
  const row = toRow(await Address.findById(id));

  return {
    address: publicAddress(row, { accessKey, sessionToken: session.token }),
    accessKey,
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function loginAddress(email, accessKey) {
  const parsed = parseEmail(email);
  if (!parsed) {
    const err = new Error('Enter a valid email address');
    err.status = 400;
    throw err;
  }
  const row = toRow(await Address.findOne({ email: parsed.email }));
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
  await Address.updateOne({ _id: row.id }, { last_access: now() });
  const session = await issueSession(row.id);
  return {
    address: publicAddress(row, { sessionToken: session.token }),
    sessionToken: session.token,
    expiresAt: session.expiresAt,
  };
}

export async function issueSession(addressId) {
  await Session.deleteMany({ expires_at: { $lt: now() } });
  const token = randomToken(32);
  const created = now();
  const expiresAt = created + config.sessionTtlMs;
  await Session.create({
    _id: uuid(),
    token,
    address_id: addressId,
    created_at: created,
    expires_at: expiresAt,
  });
  return { token, expiresAt };
}

export async function resolveSession(token) {
  if (!token) return null;
  await Session.deleteMany({ expires_at: { $lt: now() } });
  const session = await Session.findOne({ token }).lean();
  if (!session || session.expires_at < now()) return null;
  const address = toRow(await Address.findById(session.address_id));
  if (!address || !address.is_active) return null;
  await Address.updateOne({ _id: address.id }, { last_access: now() });
  return { ...address, token: session.token, address_id: session.address_id, expires_at: session.expires_at };
}

export async function logoutSession(token) {
  if (token) await Session.deleteOne({ token });
}

export async function findAddressByEmail(email) {
  return toRow(await Address.findOne({ email: normalizeEmail(email) }));
}

export async function getAddress(id) {
  return toRow(await Address.findById(id));
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
