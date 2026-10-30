import { verifyToken, COOKIE_NAME } from '../utils/jwt.js';
import User from '../models/User.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware to verify JWT from HttpOnly cookie (or Bearer Authorization header)
 * and attach authenticated user to req.user.
 */
export const authenticateUser = async (req, res, next) => {
  try {
    let token = null;

    // 1. Check HttpOnly cookie
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } 
    // 2. Fallback to Bearer token header if present (useful for API testing/tools)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Authentication required. Please log in.'
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      logger.warn(`JWT verification failed: ${jwtError.message}`);
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Invalid or expired session. Please log in again.'
      });
    }

    // Verify user still exists in database
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'User account not found. Please log in again.'
      });
    }

    // Check account status
    if (user.accountStatus === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // Invalidate session if password was changed after the JWT was issued
    if (user.passwordChangedAt) {
      const changedTime = user.passwordChangedAt.getTime();
      const tokenTime = decoded.authTime || (decoded.iat ? decoded.iat * 1000 : null);
      if (tokenTime && tokenTime < changedTime) {
        return res.status(401).json({
          status: 'error',
          statusCode: 401,
          message: 'Password was recently changed. Please log in again.'
        });
      }
    }

    // Attach user to request object
    req.user = user;
    next();
  } catch (error) {
    logger.error('Error in authenticateUser middleware:', error);
    next(error);
  }
};

/**
 * Middleware factory to restrict route access to specific roles.
 * @param  {...string} allowedRoles (e.g. 'ADMIN', 'OWNER', 'CUSTOMER')
 */
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Authentication required.'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: `Forbidden: Access restricted. Role '${req.user.role}' is not authorized to access this resource.`
      });
    }

    next();
  };
};

/**
 * Optional authentication middleware:
 * Attaches req.user if a valid token exists, but does not block unauthenticated requests.
 */
export const optionalAuthenticateUser = async (req, res, next) => {
  try {
    let token = null;
    if (req.cookies && req.cookies[COOKIE_NAME]) {
      token = req.cookies[COOKIE_NAME];
    } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = verifyToken(token);
        const user = await User.findById(decoded.id);
        if (user && user.accountStatus !== 'SUSPENDED') {
          const changedTime = user.passwordChangedAt?.getTime();
          const tokenTime = decoded.authTime || (decoded.iat ? decoded.iat * 1000 : null);
          if (!changedTime || !tokenTime || tokenTime >= changedTime) {
            req.user = user;
          }
        }
      } catch {
        // Silently ignore invalid token on optional auth
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};

export default { authenticateUser, authorizeRoles, optionalAuthenticateUser };

