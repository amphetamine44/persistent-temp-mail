const buckets = new Map();

function hit(key, limit, windowMs) {
  const now = Date.now();
  const b = buckets.get(key) || { n: 0, start: now };
  if (now - b.start > windowMs) {
    b.n = 0;
    b.start = now;
  }
  b.n += 1;
  buckets.set(key, b);
  return { ok: b.n <= limit, remaining: Math.max(0, limit - b.n), retryAfter: Math.ceil((b.start + windowMs - now) / 1000) };
}

export function limit(limitN, windowMs, prefix) {
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const r = hit(`${prefix}:${ip}`, limitN, windowMs);
    res.setHeader('X-RateLimit-Remaining', String(r.remaining));
    if (!r.ok) {
      res.setHeader('Retry-After', String(r.retryAfter));
      return res.status(429).json({ error: 'Too many requests. Slow down.' });
    }
    next();
  };
}

setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [k, v] of buckets) {
    if (v.start < cutoff) buckets.delete(k);
  }
}, 10 * 60 * 1000).unref();
