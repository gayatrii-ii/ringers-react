import { z } from 'zod';

// ─── POST /vendors/referrals/invite ────────────────────────────────────────
export const inviteVendorSchema = z.object({
  body: z.object({
    refereePhone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number format').optional().nullable(),
    refereeEmail: z.string().email('Invalid email address').optional().nullable(),
  }).refine((data) => Boolean(data.refereePhone || data.refereeEmail), {
    message: 'At least one of refereePhone or refereeEmail must be provided',
  }),
});

// ─── PATCH /admin/referrals/:id/reward ─────────────────────────────────────
export const updateRewardStatusSchema = z.object({
  body: z.object({
    rewardStatus: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']),
    rewardAmount: z.number().nonnegative('Reward amount cannot be negative').optional(),
    rewardNotes: z.string().max(500).optional().nullable(),
  }),
  params: z.object({
    id: z.string().uuid('Invalid referral ID format'),
  }),
});

// ─── GET /vendors/referrals (query) ────────────────────────────────────────
export const listReferralsSchema = z.object({
  query: z.object({
    status: z.enum(['INVITED', 'REGISTERED', 'APPROVED', 'ACTIVE']).optional(),
    rewardStatus: z.enum(['PENDING', 'APPROVED', 'PAID', 'CANCELLED']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});
