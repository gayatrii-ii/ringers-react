import { z } from 'zod';

export const assignDeliverySchema = z.object({
  riderId: z.string().uuid('Invalid delivery rider user ID format'),
});

export const rejectAssignmentSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required').max(500),
});

export const completeDeliveryOtpSchema = z.object({
  otpCode: z.string().length(4, 'OTP must be a 4-digit numeric code'),
});

export const reportDeliveryFailureSchema = z.object({
  reasonCode: z.enum([
    'CUSTOMER_UNAVAILABLE',
    'WRONG_ADDRESS',
    'CUSTOMER_REFUSED',
    'CANNOT_CONTACT_CUSTOMER',
    'OTHER',
  ]),
  notes: z.string().max(500).optional().nullable(),
});

export const recordLocationSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
  accuracy: z.number().nonnegative().optional().nullable(),
});

export const orderIdParamSchema = z.object({
  id: z.string().uuid('Invalid order ID format'),
});

export const assignmentIdParamSchema = z.object({
  id: z.string().uuid('Invalid assignment ID format'),
});
