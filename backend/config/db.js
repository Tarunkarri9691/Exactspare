import mongoose from 'mongoose';
import dns from 'dns';
import { logger } from '../utils/logger.js';

// Configure reliable DNS servers to resolve MongoDB Atlas SRV records without querySrv ETIMEOUT
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Gracefully fallback if environment prohibits changing DNS servers
}

const STATE_NAMES = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting'
};

let listenersRegistered = false;
let connectingPromise = null;
let lastConnectionError = null;

const setupListeners = () => {
  if (listenersRegistered) return;
  listenersRegistered = true;

  mongoose.connection.on('connected', () => {
    lastConnectionError = null;
    logger.info(`MongoDB connected successfully to ${mongoose.connection.host}/${mongoose.connection.name}`);
  });

  mongoose.connection.on('error', (err) => {
    lastConnectionError = err;
    logger.error(`MongoDB connection error: ${err.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB connection disconnected');
  });
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
    name: isConnected ? mongoose.connection.name : null,
    lastError: lastConnectionError ? lastConnectionError.message : null
  };
};

const FALLBACK_MONGODB_URI =
  'mongodb+srv://tarunkarri48_db_user:Tarun123@cluster0.jqvpdqf.mongodb.net/exactspare?retryWrites=true&w=majority';

/**
 * Connect to MongoDB instance using MONGODB_URI or MONGO_URI environment variable (with Atlas fallback).
 * Gracefully handles connection failures without crashing the application.
 * Caches connection promise to optimize serverless cold starts.
 */
export const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return true;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || FALLBACK_MONGODB_URI;

  if (!uri || uri.trim() === '') {
    lastConnectionError = new Error('MONGODB_URI (or MONGO_URI) is not defined in environment variables');
    logger.warn('MONGODB_URI (or MONGO_URI) is not defined in environment variables. Database connection skipped.');
    return false;
  }

  setupListeners();

  connectingPromise = (async () => {
    try {
      logger.info('Attempting to connect to MongoDB...');
      await mongoose.connect(uri, {
        dbName: 'exactspare',
        serverSelectionTimeoutMS: 20000, // 20 seconds timeout for Atlas DNS/TLS handshake
        maxPoolSize: 10, // Maintain up to 10 socket connections
        socketTimeoutMS: 45000 // Close sockets after 45 seconds of inactivity
      });
      lastConnectionError = null;
      return true;
    } catch (error) {
      lastConnectionError = error;
      logger.error(`Failed to connect to MongoDB: ${error.message}`);
      return false;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
};

export default connectDB;
