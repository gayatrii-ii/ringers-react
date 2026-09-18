import { z } from 'zod';

export const inviteVendorSchema = z.object({
  refereePhone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format').optional().nullable(),
  refereeEmail: z.string().email('Invalid email address').optional().nullable(),
}).refine((data) => Boolean(data.refereePhone || data.refereeEmail), {
  message: 'At least one of refereePhone or refereeEmail must be provided',
});

export const updateRewardStatusSchema = z.object({
  rewardStatus: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']),
  rewardAmount: z.number().nonnegative('Reward amount cannot be negative').optional(),
  rewardNotes: z.string().max(500).optional().nullable(),
});

export const listReferralsSchema = z.object({
  status: z.enum(['INVITED', 'REGISTERED', 'APPROVED', 'ACTIVE']).optional(),
  rewardStatus: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).default('1'),
  limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
});
