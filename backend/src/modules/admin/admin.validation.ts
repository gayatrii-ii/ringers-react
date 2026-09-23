import { z } from 'zod';

export const generateKeySchema = z.object({
  body: z.object({
    expiryDays: z.number().int().min(1).max(365).default(30),
    customCode: z
      .string()
      .min(6)
      .max(50)
      .regex(/^[A-Z0-9_-]+$/, 'Custom code must be uppercase alphanumeric with dashes/underscores')
      .optional(),
  }),
});

export const keyQuerySchema = z.object({
  query: z.object({
    status: z.enum(['AVAILABLE', 'USED', 'EXPIRED', 'REVOKED']).optional(),
    search: z.string().optional(),
    page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default('1'),
    limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default('20'),
  }),
});

export const reviewVendorRequestSchema = z.object({
  body: z.object({
    status: z.enum(['APPROVED', 'REJECTED']),
    rejectionReason: z.string().max(500).optional(),
    expiryDays: z.number().int().min(1).max(365).default(14),
  }),
});

export const assignDeliveryRequestSchema = z.object({
  body: z.object({
    vendorId: z.string().uuid('Valid vendor UUID is required'),
    notes: z.string().max(500).optional(),
  }),
});

export const publicVendorRequestSchema = z.object({
  body: z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters'),
    shopName: z.string().optional(),
    ownerName: z.string().min(2, 'Owner name is required'),
    mobile: z.string().min(10, 'Valid 10+ digit mobile number is required'),
    email: z.string().email('Invalid email address'),
    businessDetails: z.string().max(1000).optional(),
  }),
});

export const publicDeliveryJobRequestSchema = z.object({
  body: z.object({
    fullName: z.string().min(2, 'Full name is required'),
    mobile: z.string().min(10, 'Valid 10+ digit mobile number is required'),
    email: z.string().email('Invalid email address').optional(),
    address: z.string().min(5, 'Address is required'),
    city: z.string().min(2, 'City is required'),
    vehicleType: z.string().optional(),
    drivingLicenseNumber: z.string().optional(),
  }),
});

export const updateCustomerStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid customer UUID is required'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'SUSPENDED']),
  }),
});

export const adminVendorQuerySchema = z.object({
  query: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING']).optional(),
    search: z.string().optional(),
    city: z.string().optional(),
    page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default('1'),
    limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default('20'),
  }),
});

export const applicantRequestStatusQuerySchema = z.object({
  query: z.object({
    mobile: z.string().min(10, 'Mobile number is required'),
  }),
});

