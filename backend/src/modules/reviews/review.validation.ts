import { z } from 'zod';

export const createReviewSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order UUID is required'),
    vendorRating: z
      .number({ invalid_type_error: 'vendorRating must be a number' })
      .int('Rating must be an integer')
      .min(1, 'Minimum rating is 1')
      .max(5, 'Maximum rating is 5'),
    deliveryRating: z
      .number({ invalid_type_error: 'deliveryRating must be a number' })
      .int('Rating must be an integer')
      .min(1, 'Minimum rating is 1')
      .max(5, 'Maximum rating is 5')
      .optional()
      .nullable(),
    vendorReview: z
      .string()
      .trim()
      .max(1000, 'Vendor review cannot exceed 1000 characters')
      .optional()
      .nullable(),
    deliveryReview: z
      .string()
      .trim()
      .max(1000, 'Delivery review cannot exceed 1000 characters')
      .optional()
      .nullable(),
  }),
});

export const vendorReviewQuerySchema = z.object({
  params: z.object({
    vendorId: z.string().uuid('Valid vendor UUID is required'),
  }),
  query: z.object({
    page: z
      .string()
      .transform((v) => Math.max(1, parseInt(v, 10) || 1))
      .default('1'),
    limit: z
      .string()
      .transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20)))
      .default('20'),
  }),
});
