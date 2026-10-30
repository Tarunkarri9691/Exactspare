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
 * Rate limiter for AI Assistant queries
 * Protects AI provider quotas and backend computation resources.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // Limit each IP to 40 assistant interactions per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'AI Assistant query limit reached. Please wait a few moments before sending more questions.'
  }
});

/**
 * Rate limiter for Image-based spare part search operations
 */
export const imageSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 image searches per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Image search rate limit reached. Please wait a few moments before uploading more images.'
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

/**
 * Rate limiter for Customer Support ticket creation
 * Prevents spamming ticket creation
 */
export const supportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 25, // Limit to 25 ticket creations per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Support ticket rate limit reached. Please wait a few moments before submitting another request.'
  }
});

/**
 * Rate limiter for Password Reset requests
 * Prevents enumeration attacks and email flooding.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 password reset attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many password reset requests from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for Email Verification requests
 */
export const verificationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit to 10 verification requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many verification attempts from this IP. Please try again after 15 minutes.'
  }
});

/**
 * Rate limiter for Change Password endpoint
 */
export const changePasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit to 15 change password attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'error',
    statusCode: 429,
    message: 'Too many password change attempts. Please try again after 15 minutes.'
  }
});

export default {
  authLimiter,
  orderLimiter,
  aiLimiter,
  imageSearchLimiter,
  apiLimiter,
  supportLimiter,
  passwordResetLimiter,
  verificationLimiter,
  changePasswordLimiter
};


