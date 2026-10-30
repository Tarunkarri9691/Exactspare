import dotenv from 'dotenv';

// Load environment variables before any other imports that might read them
dotenv.config();


import { validateEnvironment, config } from './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';
import { logger } from './utils/logger.js';
import { startSubscriptionScheduler, stopSubscriptionScheduler } from './services/subscriptionScheduler.js';

import mongoose from 'mongoose';

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

  // Start background recurring subscription expiry tracker & reminder service
  startSubscriptionScheduler();

  const server = app.listen(PORT, () => {
    logger.info(`EXACTSPARE Server listening on port ${PORT}`);
    logger.info(`Health check: http://localhost:${PORT}/api/health`);
    logger.info(`Database health: http://localhost:${PORT}/api/health/db`);
  });

  // Handle port conflicts & startup errors cleanly
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`[PORT CONFLICT] Port ${PORT} is already in use by another running process.`);
      logger.error('Diagnostic & Recovery Guidance:');
      logger.error(`  1. To identify the process using port ${PORT} in Windows PowerShell:`);
      logger.error(`     Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue | Select-Object OwningProcess, LocalAddress, State`);
      logger.error(`  2. If an old "npm run dev" or Node process was left running, terminate it using:`);
      logger.error(`     Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT} -ErrorAction SilentlyContinue).OwningProcess -Force`);
      logger.error(`  3. Or to run on another port, set PORT=5001 in backend/.env`);
      process.exit(1);
    } else {
      logger.error('Unexpected server error during startup:', err.message);
      process.exit(1);
    }
  });

  // Graceful shutdown
  const handleShutdown = (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    stopSubscriptionScheduler();
    server.close(async () => {
      logger.info('HTTP server closed.');
      try {
        if (mongoose.connection.readyState !== 0) {
          await mongoose.connection.close(false);
          logger.info('MongoDB connection closed.');
        }
      } catch (dbCloseErr) {
        logger.error('Error closing MongoDB connection:', dbCloseErr.message);
      }
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
