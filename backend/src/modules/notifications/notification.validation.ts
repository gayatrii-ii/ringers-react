import { z } from 'zod';

export const notificationQuerySchema = z.object({
  query: z.object({
    isRead: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    type: z.string().trim().optional(),
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

export const notificationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid notification UUID is required'),
  }),
});

export const registerDeviceTokenSchema = z.object({
  body: z.object({
    fcmToken: z.string().trim().min(10, 'Valid FCM token is required').max(1000),
    deviceType: z.enum(['ANDROID', 'IOS', 'WEB']).default('ANDROID'),
  }),
});

export const adminBroadcastSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(255),
    message: z.string().trim().min(5, 'Message must be at least 5 characters').max(2000),
    targetRole: z.enum(['ALL', 'CUSTOMER', 'VENDOR', 'DELIVERY_BOY']).default('ALL'),
    lang: z.enum(['EN', 'HI', 'MR']).default('EN'),
  }),
});
