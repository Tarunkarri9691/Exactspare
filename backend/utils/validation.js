import { z } from 'zod';

// Password policy: at least 8 characters, at least one letter, and at least one number
const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&_\-#]{8,}$/;

export const registerSchema = z.object({
  name: z.string().trim()
    .min(2, { message: 'Full name must be at least 2 characters long' })
    .max(100, { message: 'Full name cannot exceed 100 characters' }),
  email: z.string().trim().toLowerCase()
    .email({ message: 'Please provide a valid email address' }),
  phone: z.string().trim()
    .regex(/^[0-9+()\- ]{7,20}$/, { message: 'Please provide a valid phone number (7-20 digits)' }),
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
