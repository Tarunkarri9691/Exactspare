/**
 * Application Logger utility
 * Formats console output with ISO timestamps and log levels.
 * Automatically sanitizes sensitive security fields (passwords, tokens, cookies, secrets).
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'token',
  'jwt',
  'secret',
  'jwt_secret',
  'authorization',
  'cookie',
  'set-cookie',
  'creditcard',
  'cardnumber',
  'cvv',
  'apikey',
  'api_key'
]);

/**
 * Recursively redacts sensitive keys from metadata objects before logging
 */
const sanitizeMeta = (obj, depth = 0) => {
  if (depth > 5 || !obj) return obj;

  if (typeof obj === 'string') {
    // Check if string contains bearer token pattern
    if (/bearer\s+[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/i.test(obj)) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMeta(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const clean = {};
    for (const [key, value] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        clean[key] = sanitizeMeta(value, depth + 1);
      } else if (typeof value === 'string' && /bearer\s+[A-Za-z0-9-_=]+/i.test(value)) {
        clean[key] = '[REDACTED_AUTH_HEADER]';
      } else {
        clean[key] = value;
      }
    }
    return clean;
  }

  return obj;
};

const formatMessage = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  let metaStr = '';
  if (meta !== undefined && meta !== null) {
    try {
      const sanitized = sanitizeMeta(meta);
      metaStr = ` ${typeof sanitized === 'object' ? JSON.stringify(sanitized) : sanitized}`;
    } catch {
      metaStr = ' [UNSERIALIZABLE_META]';
    }
  }
  return `[${timestamp}] [${level}] ${message}${metaStr}`;
};

export const logger = {
  info: (message, meta) => {
    console.log(formatMessage('INFO', message, meta));
  },
  warn: (message, meta) => {
    console.warn(formatMessage('WARN', message, meta));
  },
  error: (message, meta) => {
    console.error(formatMessage('ERROR', message, meta));
  },
  debug: (message, meta) => {
    if (process.env.NODE_ENV === 'development') {
      console.debug(formatMessage('DEBUG', message, meta));
    }
  }
};

export default logger;
