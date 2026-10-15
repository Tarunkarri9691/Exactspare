import dotenv from 'dotenv';
dotenv.config();

import { logger } from '../utils/logger.js';

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  mongodbUri: process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/exactspare',
  jwtSecret: process.env.JWT_SECRET || 'exactspare_super_secret_jwt_key_change_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,
  paymentGateway: {
    enabled: process.env.PAYMENT_GATEWAY_ENABLED === 'true',
    keyId: process.env.PAYMENT_GATEWAY_KEY_ID || '',
    keySecret: process.env.PAYMENT_GATEWAY_KEY_SECRET || ''
  },
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    openAiApiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || ''
  }
};

/**
 * Validates required environment variables for production deployment.
 * Fails fast with clear error message if any critical configuration is missing or insecure.
 */
export const validateEnvironment = () => {
  const isProd = config.isProduction;

  if (isProd) {
    const missing = [];

    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      missing.push('MONGODB_URI (or MONGO_URI)');
    }

    if (!process.env.JWT_SECRET) {
      missing.push('JWT_SECRET');
    } else if (process.env.JWT_SECRET === 'exactspare_super_secret_jwt_key_change_in_production') {
      throw new Error(
        'SECURITY VIOLATION: Default development JWT_SECRET is prohibited in production. Provide a cryptographically secure key.'
      );
    }

    if (!process.env.FRONTEND_URL && !process.env.CLIENT_URL) {
      missing.push('FRONTEND_URL (or CLIENT_URL)');
    }

    if (missing.length > 0) {
      throw new Error(
        `CRITICAL CONFIGURATION ERROR: Missing required production environment variables: ${missing.join(', ')}`
      );
    }
  } else {
    // Development checks & helpful warnings
    if (!process.env.JWT_SECRET) {
      logger.warn('JWT_SECRET is unset in development; falling back to local default key.');
    }
    if (!process.env.MONGODB_URI && !process.env.MONGO_URI) {
      logger.warn('MONGODB_URI is unset; defaulting to local mongodb://127.0.0.1:27017/exactspare.');
    }
  }

  return true;
};

export default config;
