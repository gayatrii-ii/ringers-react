import { z } from 'zod';

export const activateDeliveryBoySchema = z.object({
  jobRequestId: z.string().uuid('Invalid job request ID format'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
});

export const listVendorDeliveryRequestsSchema = z.object({
  status: z.enum(['CONNECTED', 'ACTIVATED']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
});
