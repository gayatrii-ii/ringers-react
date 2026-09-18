import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    identifier: z
      .string()
      .min(3, 'Identifier must be at least 3 characters (email, phone, or User ID)'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
  }),
});

export const vendorRegisterSchema = z.object({
  body: z.object({
    privateKey: z.string().min(6, 'Private Registration Key is required'),
    businessName: z.string().min(2, 'Business name must be at least 2 characters'),
    businessCode: z
      .string()
      .min(2, 'Business code must be at least 2 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Business code must contain only letters, numbers, hyphens, and underscores'),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    email: z.string().email('Invalid email address'),
    phone: z.string().min(10, 'Valid phone number is required'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    description: z.string().optional(),
  }),
});

export const sendOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid 10+ digit phone number is required'),
    purpose: z
      .enum(['VERIFICATION', 'LOGIN', 'PASSWORD_RESET', 'DELIVERY_CONFIRMATION'])
      .default('VERIFICATION'),
  }),
});

export const verifyOtpSchema = z.object({
  body: z.object({
    phone: z.string().min(10, 'Valid 10+ digit phone number is required'),
    otpCode: z.string().length(6, 'OTP must be exactly 6 digits'),
    purpose: z
      .enum(['VERIFICATION', 'LOGIN', 'PASSWORD_RESET', 'DELIVERY_CONFIRMATION'])
      .default('VERIFICATION'),
  }),
});

export const refreshTokenSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, 'Refresh token is required'),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    phone: z
      .string()
      .trim()
      .regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (must be 10 digits starting with 6-9)'),
    otp: z.string().trim().min(4, 'OTP must be at least 4 digits').max(6, 'OTP must be at most 6 digits'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(100, 'Password is too long'),
  }),
});

export const changePasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters')
      .max(100, 'Password is too long'),
  }),
});
