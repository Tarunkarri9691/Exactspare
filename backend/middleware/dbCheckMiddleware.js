import mongoose from 'mongoose';

/**
 * Middleware that verifies MongoDB connectivity before attempting database queries.
 * Prevents requests from hanging for 10 seconds when MongoDB service is stopped.
 */
export const requireDatabaseConnection = (req, res, next) => {
  // readyState: 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState !== 1) {
    return res.status(503).json({
      status: 'error',
      statusCode: 503,
      message: 'MongoDB is currently offline. Please start the MongoDB service on your computer.'
    });
  }
  next();
};

export default requireDatabaseConnection;
