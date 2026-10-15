import dotenv from 'dotenv';

// Load environment variables before any other imports that might read them
dotenv.config();

import { validateEnvironment, config } from './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';

const PORT = config.port;

// Initialize server and database connection
const startServer = async () => {
  // Validate production environment requirements
  try {
    validateEnvironment();
  } catch (err) {
    logger.error('Environment validation failed:', err.message);
    process.exit(1);
  }

  logger.info(`Starting EXACTSPARE Backend in ${config.nodeEnv} mode...`);

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
