import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';

/**
 * Middleware that verifies MongoDB connectivity before attempting database queries.
 * In serverless environments, automatically triggers connection if disconnected.
 */
export const requireDatabaseConnection = async (req, res, next) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'error',
      statusCode: 503,
      message: 'MongoDB database is currently offline or unreachable. Please verify your connection string.'
    });
  }
  next();
};

export default requireDatabaseConnection;
