import { logger } from '../utils/logger.js';

/**
 * Centralized Error-Handling Middleware
 * Catches any errors passed via next(err) and formats clean JSON response.
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || res.statusCode === 200 ? 500 : res.statusCode;
  const isDevelopment = process.env.NODE_ENV === 'development';

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}: ${err.message}`, {
    stack: isDevelopment ? err.stack : undefined
  });

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message: err.message || 'An unexpected internal server error occurred.',
    ...(isDevelopment && { stack: err.stack })
  });
};

export default errorHandler;
