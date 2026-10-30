import crypto from 'crypto';
import User from '../models/User.js';
import Shop from '../models/Shop.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  formatZodErrors
} from '../utils/validation.js';
import { generateToken, sendAuthCookie, clearAuthCookie } from '../utils/jwt.js';
import { logger } from '../utils/logger.js';
import emailService from '../services/emailService.js';

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
      accountStatus: 'ACTIVE',
      isEmailVerified: false
    });

    // 6. Auto-create active and approved shop if user registered as OWNER
    if (newUser.role === 'OWNER') {
      try {
        await Shop.create({
          ownerId: newUser._id,
          name: `${newUser.name}'s Auto Spares`,
          category: 'MULTI_CATEGORY',
          description: `${newUser.name}'s verified spare parts shop.`,
          address: {
            addressLine: 'Main Road',
            city: 'Hyderabad',
            state: 'Telangana',
            postalCode: '500001',
            location: {
              type: 'Point',
              coordinates: [78.4867, 17.3850]
            }
          },
          contact: {
            phone: newUser.phone || '9999999999',
            email: newUser.email
          },
          openingHours: 'Mon-Sat: 09:00 AM - 08:00 PM',
          images: [],
          isApproved: true,
          isActive: true,
          approvedAt: new Date()
        });
      } catch (shopErr) {
        logger.warn(`Failed to auto-create shop for owner ${newUser.email}: ${shopErr.message}`);
      }
    }

    // 7. Generate JWT and set HttpOnly cookie
    const token = generateToken({ id: newUser._id, role: newUser.role });
    sendAuthCookie(res, token);

    logger.info(`New user registered successfully: ${newUser.email} as [${newUser.role}]`);

    // Async welcome email dispatch (failsafe, never crashes registration)
    emailService.sendWelcomeEmail(newUser).catch((emailErr) => {
      logger.warn(`Failed to dispatch welcome email to ${newUser.email}: ${emailErr.message}`);
    });

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

    // 3. Verify password strictly with bcrypt (only the one exact password works)
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: GENERIC_AUTH_ERROR
      });
    }

    // 3.5. Ensure ADMIN role login is strictly restricted to naidutarun864@gmail.com
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || 'naidutarun864@gmail.com').trim().toLowerCase();
    if (user.role === 'ADMIN' && user.email.toLowerCase() !== configuredAdminEmail) {
      logger.warn(`Admin login attempt from unauthorized email: ${user.email}`);
      return res.status(403).json({
        status: 'error',
        statusCode: 403,
        message: 'Administrative console is restricted to the authorized administrator account.'
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

/**
 * Controller to request password reset link
 * @route POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const validationResult = forgotPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { email } = validationResult.data;
    const user = await User.findOne({ email });

    // Consistent generic response preventing user enumeration
    const GENERIC_RESPONSE = {
      status: 'ok',
      statusCode: 200,
      message: 'If an account with that email exists, password reset instructions have been sent.'
    };

    if (!user) {
      // Do not reveal email non-existence
      return res.status(200).json(GENERIC_RESPONSE);
    }

    // Generate cryptographically secure random token (32 bytes = 64 hex chars)
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(rawResetToken).digest('hex');

    // Token expires in 15 minutes
    user.passwordResetToken = hashedResetToken;
    user.passwordResetExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send email using configured service (never log token or password)
    emailService.sendPasswordResetEmail(user, rawResetToken).catch((err) => {
      logger.error(`Failed to send password reset email: ${err.message}`);
    });

    logger.info(`Password reset requested for email domain: @${email.split('@')[1] || 'unknown'}`);

    const isDev = process.env.NODE_ENV !== 'production';
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const devResetUrl = `${frontendUrl}/reset-password?token=${rawResetToken}`;

    if (isDev && !process.env.SMTP_USER) {
      logger.info(`[Dev Mode] Direct Password Reset URL for ${email}:\n${devResetUrl}`);
    }

    return res.status(200).json({
      ...GENERIC_RESPONSE,
      ...(isDev && !process.env.SMTP_USER ? { devResetUrl } : {})
    });
  } catch (error) {
    logger.error('forgotPassword error:', error);
    next(error);
  }
};

/**
 * Controller to reset password using token
 * @route POST /api/auth/reset-password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const validationResult = resetPasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { token, password } = validationResult.data;

    // Hash incoming token to match stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Find user with matching active token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Password reset link is invalid or has expired. Please request a new one.'
      });
    }

    // Hash new password using project standard bcrypt
    user.passwordHash = await User.hashPassword(password);
    user.passwordChangedAt = new Date();
    // Invalidate reset token immediately (single-use)
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    // Clear existing auth cookie to invalidate older session
    clearAuthCookie(res);

    logger.info(`Password successfully reset for user ID: ${user._id}`);

    return res.status(200).json({
      status: 'ok',
      statusCode: 200,
      message: 'Password has been reset successfully. Please log in with your new password.'
    });
  } catch (error) {
    logger.error('resetPassword error:', error);
    next(error);
  }
};

/**
 * Controller to change password for authenticated user
 * @route POST /api/auth/change-password
 */
export const changePassword = async (req, res, next) => {
  try {
    const validationResult = changePasswordSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { currentPassword, newPassword } = validationResult.data;

    // Fetch user with passwordHash
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!user) {
      return res.status(401).json({
        status: 'error',
        statusCode: 401,
        message: 'Authentication required. Please log in again.'
      });
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Current password is incorrect.'
      });
    }

    // Hash new password
    user.passwordHash = await User.hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    // Re-issue JWT for current session
    const freshToken = generateToken({ id: user._id, role: user.role });
    sendAuthCookie(res, freshToken);

    logger.info(`Password successfully changed for user ID: ${user._id}`);

    return res.status(200).json({
      status: 'ok',
      statusCode: 200,
      message: 'Password changed successfully.'
    });
  } catch (error) {
    logger.error('changePassword error:', error);
    next(error);
  }
};

/**
 * Controller to verify email via token link
 * @route POST /api/auth/verify-email
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const validationResult = verifyEmailSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Validation failed',
        errors: formatZodErrors(validationResult.error)
      });
    }

    const { token } = validationResult.data;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return res.status(400).json({
        status: 'error',
        statusCode: 400,
        message: 'Email verification link is invalid or has expired.'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    await user.save({ validateBeforeSave: false });

    logger.info(`Email address verified for user: ${user.email}`);

    return res.status(200).json({
      status: 'ok',
      statusCode: 200,
      message: 'Email address verified successfully!'
    });
  } catch (error) {
    logger.error('verifyEmail error:', error);
    next(error);
  }
};

/**
 * Controller to resend email verification link
 * @route POST /api/auth/resend-verification
 */
export const resendVerification = async (req, res, next) => {
  try {
    let email = req.user?.email;

    if (!email) {
      const validationResult = resendVerificationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          status: 'error',
          statusCode: 400,
          message: 'Validation failed',
          errors: formatZodErrors(validationResult.error)
        });
      }
      email = validationResult.data.email;
    }

    const user = await User.findOne({ email });

    const GENERIC_RESPONSE = {
      status: 'ok',
      statusCode: 200,
      message: 'If an unverified account with this email exists, a verification link has been sent.'
    };

    if (!user) {
      return res.status(200).json(GENERIC_RESPONSE);
    }

    if (user.isEmailVerified) {
      return res.status(200).json({
        status: 'ok',
        statusCode: 200,
        message: 'This email address is already verified.'
      });
    }

    // Generate token expiring in 24 hours
    const rawToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    emailService.sendEmailVerificationLink(user, rawToken).catch((err) => {
      logger.error(`Failed to send email verification link: ${err.message}`);
    });

    logger.info(`Resent email verification link for domain: @${email.split('@')[1] || 'unknown'}`);

    return res.status(200).json(GENERIC_RESPONSE);
  } catch (error) {
    logger.error('resendVerification error:', error);
    next(error);
  }
};

