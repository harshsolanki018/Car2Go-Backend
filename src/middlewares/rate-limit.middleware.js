function normalizeIp(req) {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function createRateLimiter({ windowMs, max, keyGenerator, message }) {
  const hits = new Map();
  let lastCleanupAt = 0;

  function cleanupExpired(now) {
    if (now - lastCleanupAt < 60 * 1000) {
      return;
    }

    for (const [key, entry] of hits.entries()) {
      if (!entry || entry.resetAt <= now) {
        hits.delete(key);
      }
    }

    lastCleanupAt = now;
  }

  return (req, res, next) => {
    const now = Date.now();
    cleanupExpired(now);
    const key = keyGenerator(req);
    const current = hits.get(key);

    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    current.count += 1;

    if (current.count > max) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((current.resetAt - now) / 1000)
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        success: false,
        message,
      });
      return;
    }

    next();
  };
}

const loginRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => {
    const ip = normalizeIp(req);
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `login:${ip}:${email || 'unknown'}`;
  },
  message: 'Too many login attempts. Please try again later.',
});

const registerRateLimit = createRateLimiter({
  windowMs: 30 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const ip = normalizeIp(req);
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `register:${ip}:${email || 'unknown'}`;
  },
  message: 'Too many registration attempts. Please try again later.',
});

module.exports = {
  loginRateLimit,
  registerRateLimit,
};
