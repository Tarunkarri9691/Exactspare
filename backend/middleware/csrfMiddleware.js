import { logger } from '../utils/logger.js';

/**
 * Origin validation CSRF protection middleware for cookie-authenticated state-changing requests.
 * Ensures state-changing requests (POST, PUT, DELETE, PATCH) originate only from allowed frontend origins.
 */
export const validateOriginCSRF = (req, res, next) => {
  // Safe HTTP methods do not change state
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const requestHost = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();

  // Helper to test if an origin/referer string is valid and authorized
  const isOriginAuthorized = (urlStr) => {
    if (!urlStr) return true;
    try {
      const url = new URL(urlStr);
      const cleanOrigin = `${url.protocol}//${url.host}`.toLowerCase();
      const hostLower = url.host.toLowerCase();

      // 1. Allow localhost / 127.0.0.1 in development or testing
      if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(hostLower)) {
        return true;
      }

      // 2. Allow same-origin requests (frontend & backend hosted on the same domain / reverse proxy)
      if (requestHost && (hostLower === requestHost || cleanOrigin === `https://${requestHost}` || cleanOrigin === `http://${requestHost}`)) {
        return true;
      }

      // 3. Allow all Vercel deployment URLs (*.vercel.app)
      if (hostLower.endsWith('.vercel.app')) {
        return true;
      }

      // 4. Allow configured production origins
      const configuredOrigins = [
        'https://exactspare.vercel.app',
        process.env.FRONTEND_URL,
        process.env.CLIENT_URL,
        process.env.RENDER_EXTERNAL_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
        ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',').map((s) => s.trim())
      ]
        .filter(Boolean)
        .map((o) => o.replace(/\/+$/, '').toLowerCase());

      return configuredOrigins.includes(cleanOrigin);
    } catch {
      return false;
    }
  };

  // If request contains an Origin header (standard for CORS fetch/XHR)
  if (origin && !isOriginAuthorized(origin)) {
    logger.warn(`Blocked CSRF state-change attempt with disallowed origin: ${origin} (Host: ${requestHost})`);
    return res.status(403).json({
      status: 'error',
      statusCode: 403,
      message: 'Forbidden: Origin validation failed (CSRF protection).'
    });
  }

  // If no Origin but Referer is present
  if (!origin && referer && !isOriginAuthorized(referer)) {
    logger.warn(`Blocked CSRF state-change attempt with disallowed referer: ${referer} (Host: ${requestHost})`);
    return res.status(403).json({
      status: 'error',
      statusCode: 403,
      message: 'Forbidden: Referer validation failed (CSRF protection).'
    });
  }

  next();
};

export default validateOriginCSRF;
