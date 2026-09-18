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
