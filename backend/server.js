import dotenv from 'dotenv';

// Load environment variables before any other imports that might read them
dotenv.config();

import app from './app.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = process.env.PORT || 5000;

// Initialize server and database connection
const startServer = async () => {
  logger.info(`Starting EXACTSPARE Backend in ${process.env.NODE_ENV || 'development'} mode...`);

  // Attempt database connection without halting server on failure
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`EXACTSPARE Server listening on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    logger.info(`Database health: http://localhost:${PORT}/api/health/db`);
  });

  // Graceful shutdown
  const handleShutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(() => {
      logger.info('HTTP server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
};

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
