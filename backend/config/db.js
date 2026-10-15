import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

/**
 * Returns current MongoDB connection state information
 */
export const getDatabaseStatus = () => {
  const readyState = mongoose.connection.readyState;
  const state = STATE_NAMES[readyState] || 'unknown';
  const isConnected = readyState === 1;

  return {
    state,
    readyState,
    isConnected,
    host: isConnected ? mongoose.connection.host : null,
    port: isConnected ? mongoose.connection.port : null,
    name: isConnected ? mongoose.connection.name : null
  };
};

/**
 * Connect to MongoDB instance using MONGODB_URI or MONGO_URI environment variable.
 * Gracefully handles missing URI or connection failures without crashing the application.
 */
export const connectDB = async () => {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (!uri || uri.trim() === '') {
    logger.warn('MONGODB_URI (or MONGO_URI) is not defined in environment variables. Database connection skipped.');
    return false;
  }

  // Setup connection event listeners
  mongoose.connection.on('connected', () => {
    logger.info(`MongoDB connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });

  try {
    logger.info('Attempting to connect to MongoDB...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout for quick feedback
      maxPoolSize: 10, // Maintain up to 10 socket connections
      socketTimeoutMS: 45000 // Close sockets after 45 seconds of inactivity
    });
    return true;
  } catch (error) {
    logger.error(`Failed to connect to MongoDB: ${error.message}`);
    // Do not crash the entire process so that health endpoints still report accurate status
    return false;
  }
};

export default connectDB;
