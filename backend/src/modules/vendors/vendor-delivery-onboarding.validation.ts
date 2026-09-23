import { z } from 'zod';

// ─── POST /vendors/delivery-boys/activate ─────────────────────────────────
export const activateDeliveryBoySchema = z.object({
  body: z.object({
    jobRequestId: z.string().uuid('Invalid job request ID format'),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
  }),
});

// ─── GET /vendors/delivery-boys/job-requests ──────────────────────────────
export const listVendorDeliveryRequestsSchema = z.object({
  query: z.object({
    status: z.enum(['CONNECTED', 'ACTIVATED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// ─── GET /vendors/delivery-boys ───────────────────────────────────────────
export const listVendorDeliveryBoysSchema = z.object({
  query: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});

// ─── POST /vendors/delivery-boys (Flow A - Direct Creation) ──────────────
export const createDirectDeliveryBoySchema = z.object({
  body: z.object({
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    mobile: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number (10 digits starting with 6-9)'),
    email: z.string().email('Invalid email address').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters long'),
    vehicleType: z.enum(['BIKE', 'SCOOTER', 'CYCLE', 'ELECTRIC_VEHICLE']).default('BIKE'),
    licenseNumber: z.string().optional(),
    profilePhotoUrl: z.string().url('Invalid profile photo URL').optional(),
  }),
});

// ─── PATCH /vendors/delivery-boys/:riderId/reset-password ────────────────
export const vendorResetRiderPasswordSchema = z.object({
  params: z.object({
    riderId: z.string().uuid('Invalid rider user ID format'),
  }),
  body: z.object({
    password: z.string().min(8, 'New password must be at least 8 characters long'),
  }),
});

// ─── PATCH /vendors/delivery-boys/:riderId/status ─────────────────────────
export const updateVendorRiderStatusSchema = z.object({
  params: z.object({
    riderId: z.string().uuid('Invalid rider user ID format'),
  }),
  body: z.object({
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']),
  }),
});


