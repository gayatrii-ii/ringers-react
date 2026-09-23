import { z } from 'zod';

const dateRangeQuery = z.object({
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be YYYY-MM-DD')
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be YYYY-MM-DD')
    .optional(),
});

export const adminAnalyticsQuerySchema = z.object({
  query: dateRangeQuery.extend({
    period: z.enum(['today', 'week', 'month', 'year', 'custom']).default('month'),
  }),
});

export const vendorAnalyticsQuerySchema = z.object({
  query: dateRangeQuery.extend({
    period: z.enum(['today', 'week', 'month', 'year', 'custom']).default('month'),
  }),
});

export const vendorReportPaginationQuerySchema = z.object({
  query: dateRangeQuery.extend({
    period: z.enum(['today', 'week', 'month', 'year', 'custom']).default('month'),
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

export const leaderboardQuerySchema = z.object({
  query: z.object({
    limit: z
      .string()
      .transform((v) => Math.min(50, Math.max(1, parseInt(v, 10) || 10)))
      .default('10'),
    period: z.enum(['today', 'week', 'month', 'year']).default('month'),
  }),
});

export const vendorOverviewParamsSchema = z.object({
  params: z.object({
    vendorId: z.string().uuid('Invalid vendor ID'),
  }),
});

export const adminSalesReportQuerySchema = z.object({
  query: dateRangeQuery.extend({
    period: z.enum(['today', 'week', 'month', 'year', 'custom']).default('month'),
    vendorId: z.string().uuid().optional(),
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

export const adminOrdersReportQuerySchema = z.object({
  query: dateRangeQuery.extend({
    period: z.enum(['today', 'week', 'month', 'year', 'custom']).default('month'),
    status: z.string().optional(),
    vendorId: z.string().uuid().optional(),
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

