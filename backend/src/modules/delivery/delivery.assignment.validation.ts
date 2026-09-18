import { z } from 'zod';

// ─── POST /orders/:id/assign-delivery ─────────────────────────────────────
export const assignDeliverySchema = z.object({
  body: z.object({
    riderId: z.string().uuid('Invalid delivery rider user ID format'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid order ID format'),
  }),
});

// ─── POST /delivery/assignments/:id/reject ────────────────────────────────
export const rejectAssignmentSchema = z.object({
  body: z.object({
    reason: z.string().min(1, 'Rejection reason is required').max(500),
  }),
  params: z.object({
    id: z.string().uuid('Invalid assignment ID format'),
  }),
});

// ─── POST /delivery/orders/:id/complete-delivery ──────────────────────────
export const completeDeliveryOtpSchema = z.object({
  body: z.object({
    otpCode: z.string().length(4, 'OTP must be a 4-digit numeric code'),
  }),
  params: z.object({
    id: z.string().uuid('Invalid order ID format'),
  }),
});

// ─── POST /delivery/assignments/:id/fail ──────────────────────────────────
export const reportDeliveryFailureSchema = z.object({
  body: z.object({
    reasonCode: z.enum([
      'CUSTOMER_UNAVAILABLE',
      'WRONG_ADDRESS',
      'CUSTOMER_REFUSED',
      'CANNOT_CONTACT_CUSTOMER',
      'OTHER',
    ]),
    notes: z.string().max(500).optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid assignment ID format'),
  }),
});

// ─── POST /delivery/location ───────────────────────────────────────────────
export const recordLocationSchema = z.object({
  body: z.object({
    latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
    longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
    accuracy: z.number().nonnegative().optional().nullable(),
  }),
});

// ─── Params: :id as order UUID ────────────────────────────────────────────
export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid order ID format'),
  }),
});

// ─── Params: :id as assignment UUID ──────────────────────────────────────
export const assignmentIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid assignment ID format'),
  }),
});
