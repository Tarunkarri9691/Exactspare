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
  const configuredFrontend = process.env.FRONTEND_URL || 'http://localhost:5173';
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    configuredFrontend,
    process.env.CLIENT_URL,
    ...configuredOrigins,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
  ].filter(Boolean);

  // Check if origin is localhost on any port in development
  const isLocalDev =
    process.env.NODE_ENV !== 'production' &&
    ((origin && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) ||
      (referer && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(referer)));

  // If request contains an Origin header (standard for CORS fetch/XHR)
  if (origin) {
    if (!isLocalDev && !allowedOrigins.includes(origin)) {
      logger.warn(`Blocked CSRF state-change attempt with disallowed origin: ${origin}`);
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: Origin validation failed (CSRF protection).'
      });
    }
  } 
  // If no Origin but Referer is present
  else if (referer) {
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (!isLocalDev && !allowedOrigins.includes(refererOrigin)) {
        logger.warn(`Blocked CSRF state-change attempt with disallowed referer: ${refererOrigin}`);
        return res.status(403).json({
          status: 'error',
          statusCode: 403,
          message: 'Forbidden: Referer validation failed (CSRF protection).'
        });
      }
    } catch {
      // Ignore URL parse error on non-standard referers
    }
  }

  next();
};

export default validateOriginCSRF;
