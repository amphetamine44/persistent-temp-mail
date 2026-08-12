import { resolveSession, getAddress } from '../services/addresses.js';

export function bearer(req) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Bearer ')) return h.slice(7).trim();
  return req.query.token || req.headers['x-session-token'] || '';
}

export async function requireAuth(req, res, next) {
  try {
    const token = bearer(req);
    const session = await resolveSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalid. Sign in with your address and access key.' });
    }
    req.sessionToken = token;
    req.sessionId = session.token;
    req.address = await getAddress(session.address_id);
    if (!req.address) {
      return res.status(401).json({ error: 'Address no longer exists' });
    }
    next();
  } catch (err) {
    next(err);
  }
}
