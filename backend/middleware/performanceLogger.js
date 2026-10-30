import { logger } from '../utils/logger.js';

const SLOW_REQUEST_THRESHOLD_MS = 200; // Log requests taking longer than 200ms

/**
 * Performance and Slow Request Monitor Middleware
 * Measures response latency and logs slow requests without exposing sensitive payload data
 */
export const performanceLogger = (req, res, next) => {
  const startHrTime = process.hrtime();

  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${elapsedTimeMs}ms`);
    }
    return originalWriteHead.apply(this, args);
  };

  res.on('finish', () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeMs = (elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6).toFixed(2);

    // Only flag slow requests to avoid log noise
    if (elapsedTimeMs > SLOW_REQUEST_THRESHOLD_MS && !req.url.includes('/uploads/')) {
      logger.warn(`[PERF ALERT] Slow request: ${req.method} ${req.baseUrl || ''}${req.path} completed in ${elapsedTimeMs}ms (Status: ${res.statusCode})`);
    }
  });

  next();
};
