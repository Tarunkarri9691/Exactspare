/**
 * In-memory safe public response cache with TTL
 * Strictly caches only public, idempotent GET requests.
 * NEVER caches private accounts, authentication tokens, carts, orders, or admin data.
 */

const cacheStore = new Map();

/**
 * Public Cache Middleware Factory
 * @param {number} ttlSeconds - Time-to-live in seconds (default 60s)
 */
export const publicCache = (ttlSeconds = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Safety check: Never cache authenticated or private requests
    if (req.headers.authorization || req.cookies?.token || req.headers.cookie?.includes('token=')) {
      res.setHeader('X-Cache', 'BYPASS');
      return next();
    }

    const cacheKey = `${req.originalUrl || req.url}`;
    const cachedEntry = cacheStore.get(cacheKey);

    if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Content-Type', cachedEntry.contentType || 'application/json');
      return res.status(cachedEntry.status).send(cachedEntry.body);
    }

    res.setHeader('X-Cache', 'MISS');

    // Intercept res.send to capture response body
    const originalSend = res.send.bind(res);

    res.send = (body) => {
      // Only cache successful 200 OK responses
      if (res.statusCode === 200) {
        cacheStore.set(cacheKey, {
          body,
          status: res.statusCode,
          contentType: res.getHeader('content-type') || 'application/json',
          expiresAt: Date.now() + ttlSeconds * 1000
        });

        // Periodic pruning if cache exceeds 500 entries
        if (cacheStore.size > 500) {
          const now = Date.now();
          for (const [key, val] of cacheStore.entries()) {
            if (val.expiresAt <= now) cacheStore.delete(key);
          }
        }
      }

      return originalSend(body);
    };

    next();
  };
};

/**
 * Programmatic cache invalidation helper
 */
export const clearPublicCache = (keyPrefix = '') => {
  if (!keyPrefix) {
    cacheStore.clear();
    return;
  }
  for (const key of cacheStore.keys()) {
    if (key.startsWith(keyPrefix)) cacheStore.delete(key);
  }
};
