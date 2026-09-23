import { z } from 'zod';

export const updateDeliveryProfileSchema = z.object({
  body: z
    .object({
      vehicleType: z.enum(['BIKE', 'SCOOTER', 'CYCLE', 'VAN', 'OTHER']).optional(),
      vehicleNumber: z
        .string()
        .trim()
        .min(3, 'Vehicle number must be at least 3 characters')
        .max(50)
        .regex(/^[A-Z0-9 -]+$/i, 'Invalid vehicle registration number format')
        .optional()
        .nullable(),
      licenseNumber: z
        .string()
        .trim()
        .min(3, 'Driving license number must be at least 3 characters')
        .max(100)
        .optional()
        .nullable(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one delivery profile field must be provided for update',
    }),
});

export const updateDutyStatusSchema = z.object({
  body: z.object({
    status: z.enum(['ONLINE', 'OFFLINE', 'BUSY'], {
      errorMap: () => ({ message: 'Duty status must be ONLINE, OFFLINE, or BUSY' }),
    }),
  }),
});

export const adminUpdateRiderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid rider UUID is required'),
  }),
  body: z.object({
    status: z.enum(['OFFLINE', 'ONLINE', 'BUSY', 'SUSPENDED']),
    notes: z.string().max(500).optional(),
  }),
});

export const updateDeliveryLanguageSchema = z.object({
  body: z.object({
    preferredLanguage: z.enum(['EN', 'HI', 'MR']),
  }),
});

