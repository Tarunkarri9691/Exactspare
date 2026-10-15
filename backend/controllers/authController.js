import User from '../models/User.js';
import { registerSchema, loginSchema, formatZodErrors } from '../utils/validation.js';
import { generateToken, sendAuthCookie, clearAuthCookie } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';

/**
 * Controller for user registration (Customer or Shop Owner)
 * @route POST /api/auth/register
 */
export const register = async (req, res, next) => {
  try {
    // 1. Validate inputs via Zod
    const validationResult = registerSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { name, email, phone, password, role } = validationResult.data;

    // 2. Extra safety: Explicitly reject any attempts to assign ADMIN role publicly
    if (req.body.role === 'ADMIN' || role === 'ADMIN') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Forbidden: Administrator accounts cannot be created via public registration.'
      });
    }

    // 3. Check for duplicate email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        status: 'error',
        statusCode: 409,
        message: 'An account with this email address already exists. Please log in or use a different email.'
      });
    }

    // 4. Hash password with bcrypt
    const passwordHash = await User.hashPassword(password);

    // 5. Create user document (preventing mass assignment of status or sensitive fields)
    const newUser = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role: role || 'CUSTOMER',
      accountStatus: 'ACTIVE'
    });

    // 6. Generate JWT and set HttpOnly cookie
    const token = generateToken({ id: newUser._id, role: newUser.role });
    sendAuthCookie(res, token);

    logger.info(`New user registered successfully: ${newUser.email} as [${newUser.role}]`);

    // 7. Return safe user data
    res.status(201).json({
      status: 'ok',
      statusCode: 201,
      message: `${newUser.role === 'OWNER' ? 'Shop Owner' : 'Customer'} registration successful.`,
      user: newUser.toJSON()
    });
  } catch (error) {
    logger.error('Registration error:', error);
    next(error);
  }
};

/**
 * Controller for user login
 * @route POST /api/auth/login
 */
export const login = async (req, res, next) => {
  try {
    // 1. Validate input schema
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { email, password } = validationResult.data;

    // 2. Find user by email and explicitly select passwordHash
    const user = await User.findOne({ email }).select('+passwordHash');

    // Generic error message that does not disclose whether email exists
    const GENERIC_AUTH_ERROR = 'Invalid email or password.';

    if (!user) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: GENERIC_AUTH_ERROR
      });
    }

    // 3. Verify password with bcrypt
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: GENERIC_AUTH_ERROR
      });
    }

    // 4. Check if account is suspended
    if (user.accountStatus === 'SUSPENDED') {
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Your account has been suspended. Please contact support.'
      });
    }

    // 5. Issue JWT and set HttpOnly cookie
    const token = generateToken({ id: user._id, role: user.role });
    sendAuthCookie(res, token);

    logger.info(`User logged in successfully: ${user.email} [${user.role}]`);

    res.status(200).json({
      status: 'ok',
      statusCode: 200,
      message: 'Login successful.',
      user: user.toJSON()
    });
  } catch (error) {
    logger.error('Login error:', error);
    next(error);
  }
};

/**
 * Controller for user logout
 * @route POST /api/auth/logout
 */
export const logout = (req, res) => {
  clearAuthCookie(res);
  logger.info(`User session logged out`);

  res.status(200).json({
    status: 'ok',
    statusCode: 200,
    message: 'Logged out successfully.'
  });
};

/**
 * Controller to get current authenticated user profile
 * @route GET /api/auth/me
 */
export const getMe = (req, res) => {
  res.status(200).json({
    status: 'ok',
    statusCode: 200,
    user: req.user.toJSON()
  });
};
