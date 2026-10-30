import { z } from 'zod';

// Password policy: at least 8 characters, at least one letter, and at least one number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&_\-#]{8,}$/;

/**
 * Strict Phone Number Validator:
 * - Rejects random digits, letters, or wrong lengths
 * - Enforces standard 10-digit mobile series (starting with 6, 7, 8, or 9)
 * - Rejects repeated digits (9999999999, 0000000000, etc.)
 * - Rejects common dummy sequences (1234567890, 9876543210, 9898989898, etc.)
 */
export const validateStrictPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, message: 'Phone number is required' };
  }
  
  let clean = phone.trim().replace(/[\s\-\(\)\.]/g, '');
  if (clean.startsWith('+91')) {
    clean = clean.slice(3);
  } else if (clean.startsWith('91') && clean.length === 12) {
    clean = clean.slice(2);
  } else if (clean.startsWith('0') && clean.length === 11) {
    clean = clean.slice(1);
  }

  if (!/^\d{10}$/.test(clean)) {
    return { valid: false, message: 'Please enter a valid 10-digit mobile number' };
  }

  if (!/^[6-9]/.test(clean)) {
    return { valid: false, message: 'Mobile number must start with 6, 7, 8, or 9' };
  }

  // Reject all repeating digits like 9999999999, 1111111111, 0000000000
  if (/^(\d)\1{9}$/.test(clean)) {
    return { valid: false, message: 'Random or repeated digits (e.g. 9999999999) are not allowed' };
  }

  // Reject common fake/dummy sequences
  const dummyNumbers = [
    '1234567890', '0123456789', '9876543210', '9898989898', 
    '9876598765', '9090909090', '9191919191', '8989898989',
    '7878787878', '6767676767', '9898987654', '9876543211',
    '9988776655', '9898987650'
  ];
  if (dummyNumbers.includes(clean)) {
    return { valid: false, message: 'Random or dummy sequence numbers are not allowed' };
  }

  // Reject 2-digit repeating patterns like 9898989898
  const firstPair = clean.slice(0, 2);
  if (clean === firstPair.repeat(5)) {
    return { valid: false, message: 'Random repetitive pattern numbers are not allowed' };
  }

  return { valid: true, cleanPhone: clean };
};

export const registerSchema = z.object({
  name: z.string().trim()
    .min(2, { message: 'Full name must be at least 2 characters long' })
    .max(100, { message: 'Full name cannot exceed 100 characters' }),
  email: z.string().trim().toLowerCase()
    .email({ message: 'Please provide a valid email address' }),
  phone: z.string().trim()
    .refine((val) => validateStrictPhoneNumber(val).valid, {
      message: 'Please provide a genuine 10-digit mobile number (starting with 6, 7, 8, or 9). Random or fake numbers are not allowed.'
    }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password cannot exceed 100 characters' })
    .regex(passwordRegex, { message: 'Password must contain at least one letter and one number' }),
  confirmPassword: z.string(),
  role: z.enum(['CUSTOMER', 'OWNER'], {
    errorMap: () => ({ message: 'Public registration allows only CUSTOMER or OWNER role.' })
  }).default('CUSTOMER')
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase()
    .email({ message: 'Please provide a valid email address' }),
  password: z.string().min(1, { message: 'Password is required' })
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase()
    .email({ message: 'Please provide a valid email address' })
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, { message: 'Reset token is required' }),
  password: z.string()
    .min(8, { message: 'Password must be at least 8 characters long' })
    .max(100, { message: 'Password cannot exceed 100 characters' })
    .regex(passwordRegex, { message: 'Password must contain at least one letter and one number' }),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword']
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: 'Current password is required' }),
  newPassword: z.string()
    .min(8, { message: 'New password must be at least 8 characters long' })
    .max(100, { message: 'New password cannot exceed 100 characters' })
    .regex(passwordRegex, { message: 'New password must contain at least one letter and one number' }),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'New passwords do not match',
  path: ['confirmPassword']
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword']
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, { message: 'Verification token is required' })
});

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase()
    .email({ message: 'Please provide a valid email address' })
});


/**
 * Helper to format Zod validation errors into a friendly array/message
 */
export const formatZodErrors = (error) => {
  const list = error?.issues || error?.errors || [];
  return list.map((err) => ({
    field: Array.isArray(err.path) ? err.path.join('.') : String(err.path || 'form'),
    message: err.message
  }));
};
