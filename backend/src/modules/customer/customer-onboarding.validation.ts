import { z } from 'zod';

// ─── Flow B: Customer Direct Registration Request (Public) ─────────────────
export const customerDirectRegistrationSchema = z.object({
  body: z.object({
    vendorId: z.string().uuid('Invalid vendor ID format'),
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format (E.164 compliant)'),
    email: z.string().email('Invalid email address').optional().nullable(),
    photoUrl: z.string().url('Invalid photo URL').optional().nullable(),
    addressLine1: z.string().min(1, 'Address is required').max(255),
    city: z.string().min(1, 'City is required').max(100),
    state: z.string().min(1, 'State is required').max(100),
    postalCode: z.string().min(4, 'Postal code must be at least 4 chars').max(20),
    notes: z.string().max(500).optional().nullable(),
  }),
});

// ─── Flow A: Vendor-Initiated Customer Registration Request ────────────────
export const vendorInitiateCustomerSchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required').max(100),
    lastName: z.string().min(1, 'Last name is required').max(100),
    phone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format (E.164 compliant)'),
    email: z.string().email('Invalid email address').optional().nullable(),
    photoUrl: z.string().url('Invalid photo URL').optional().nullable(),
    addressLine1: z.string().min(1, 'Address is required').max(255),
    city: z.string().min(1, 'City is required').max(100),
    state: z.string().min(1, 'State is required').max(100),
    postalCode: z.string().min(4, 'Postal code must be at least 4 chars').max(20),
    notes: z.string().max(500).optional().nullable(),
  }),
});

// ─── Flow A: OTP Verification ──────────────────────────────────────────────
export const verifyCustomerOtpSchema = z.object({
  body: z.object({
    otpCode: z.string().length(4, 'OTP must be a 4-digit code'),
  }),
  params: z.object({
    requestId: z.string().uuid('Invalid request ID format'),
  }),
});

// ─── Product Assignment item (nested inside activation) ────────────────────
const productAssignmentItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID'),
  isEnabled: z.boolean().default(true),
  customPrice: z.number().nonnegative('Custom price cannot be negative').optional().nullable(),
});

// ─── Activate Customer Account (Flow A & Flow B) ──────────────────────────
export const activateCustomerAccountSchema = z.object({
  body: z.object({
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    selectedProducts: z.array(productAssignmentItemSchema).optional(),
    notes: z.string().max(500).optional().nullable(),
  }),
  params: z.object({
    requestId: z.string().uuid('Invalid request ID format'),
  }),
});

// ─── Reject Registration Request ──────────────────────────────────────────
export const rejectRegistrationRequestSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
  }),
  params: z.object({
    requestId: z.string().uuid('Invalid request ID format'),
  }),
});

// ─── Vendor List Registration Requests (query params) ─────────────────────
export const listRegistrationRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['PENDING', 'OTP_VERIFIED', 'ACTIVATED', 'REJECTED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});
