import { getDatabaseStatus } from '../config/db.js';

/**
 * Controller for general API health check
 * @route GET /api/health
 */
export const getHealth = (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const dbStatus = getDatabaseStatus();
  const memUsage = process.memoryUsage();
  
  res.status(200).json({
    status: dbStatus.isConnected ? 'ok' : 'degraded',
    service: 'EXACTSPARE Backend API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development',
    database: {
      status: dbStatus.state,
      connected: dbStatus.isConnected
    },
    system: {
      nodeVersion: process.version,
      rssMemoryMb: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMb: Math.round(memUsage.heapUsed / 1024 / 1024)
    }
  });
};

/**
 * Controller for MongoDB connection health check
 * @route GET /api/health/db
 */
export const getDatabaseHealth = (req, res) => {
  const dbStatus = getDatabaseStatus();

  if (dbStatus.isConnected) {
    return res.status(200).json({
      status: 'ok',
      database: dbStatus,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(503).json({
    status: 'unavailable',
    message: 'MongoDB is currently not connected or unavailable.',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
};
