import { getDatabaseStatus } from '../config/db.js';

/**
 * Controller for general API health check
 * @route GET /api/health
 */
export const getHealth = (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  
  res.status(200).json({
    status: 'ok',
    service: 'EXACTSPARE Backend API',
    module: 'Module 1 - Project Foundation',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSeconds}s`,
    environment: process.env.NODE_ENV || 'development'
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
