import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for sensitive authentication endpoints (login, register)
 * Prevents automated brute-force attacks and credential stuffing.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many authentication attempts from this IP address. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for checkout and order placement endpoints
 * Prevents automated cart flooding, inventory depletion attacks, and rapid fake orders.
 */
export const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 35, // Limit each IP to 35 order attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Order creation rate limit exceeded. Please wait a few moments before placing another order.'
  }
});

/**
 * General API rate limiter for non-sensitive public endpoints
 * Protects server resources while allowing normal high-frequency browsing.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 600, // 600 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'API rate limit exceeded. Please slow down and try again.'
  }
});

export default { authLimiter, orderLimiter, apiLimiter };
