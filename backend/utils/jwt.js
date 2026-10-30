import jwt from 'jsonwebtoken';

const COOKIE_NAME = 'exactspare_token';

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }
  return secret;
};

/**
 * Generate a signed JWT
 */
export const generateToken = (payload) => {
  return jwt.sign(
    {
      ...payload,
      authTime: Date.now()
    },
    getJwtSecret(),
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

/**
 * Verify a JWT string
 */
export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

/**
 * Set the authentication token in a secure HttpOnly cookie
 */
export const sendAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  const domain = process.env.COOKIE_DOMAIN || undefined;

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction, // HTTPS in production
    sameSite: isProduction ? 'none' : 'lax', // 'lax' for local dev, 'none' for cross-site prod
    maxAge,
    path: '/',
    ...(domain ? { domain } : {})
  });
};

/**
 * Clear the authentication cookie upon logout
 */
export const clearAuthCookie = (res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || undefined;

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    ...(domain ? { domain } : {})
  });
};

export { COOKIE_NAME };
