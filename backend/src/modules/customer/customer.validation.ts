import { z } from 'zod';

export const updateCustomerProfileSchema = z.object({
  body: z
    .object({
      firstName: z.string().trim().min(1, 'First name cannot be empty').max(100).optional(),
      lastName: z.string().trim().min(1, 'Last name cannot be empty').max(100).optional(),
      dateOfBirth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
        .refine((dob) => {
          const birthDate = new Date(dob);
          const now = new Date();
          if (isNaN(birthDate.getTime())) return false;
          if (birthDate >= now) return false;
          // Age should be realistic: between 5 and 120 years old
          const ageYears = (now.getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          return ageYears >= 5 && ageYears <= 120;
        }, 'Date of birth must be a valid past date (age between 5 and 120)')
        .optional()
        .nullable(),
      gender: z
        .enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'])
        .optional()
        .nullable(),
      profileImage: z
        .string()
        .url('Profile image must be a valid URL')
        .max(500)
        .optional()
        .nullable(),
      preferredLanguage: z.enum(['EN', 'HI', 'MR']).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one profile field must be provided for update',
    }),
});

export const updateCustomerLanguageSchema = z.object({
  body: z.object({
    language: z.enum(['EN', 'HI', 'MR']),
  }),
});

export const createCustomerAddressSchema = z.object({
  body: z.object({
    addressType: z.enum(['HOME', 'WORK', 'OTHER']).default('HOME'),
    addressLine1: z.string().trim().min(3, 'Address line 1 must be at least 3 characters').max(255),
    addressLine2: z.string().trim().max(255).optional().nullable(),
    city: z.string().trim().min(2, 'City must be at least 2 characters').max(100),
    state: z.string().trim().min(2, 'State must be at least 2 characters').max(100),
    country: z.string().trim().min(2).max(100).default('India'),
    postalCode: z
      .string()
      .trim()
      .regex(/^[1-9][0-9]{5}$/, 'Postal code must be a valid 6-digit Indian PIN code'),
    latitude: z
      .number()
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
      .optional()
      .nullable(),
    longitude: z
      .number()
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
      .optional()
      .nullable(),
    isDefault: z.boolean().default(false),
  }),
});

export const updateCustomerAddressSchema = z.object({
  body: z
    .object({
      addressType: z.enum(['HOME', 'WORK', 'OTHER']).optional(),
      addressLine1: z.string().trim().min(3, 'Address line 1 must be at least 3 characters').max(255).optional(),
      addressLine2: z.string().trim().max(255).optional().nullable(),
      city: z.string().trim().min(2, 'City must be at least 2 characters').max(100).optional(),
      state: z.string().trim().min(2, 'State must be at least 2 characters').max(100).optional(),
      country: z.string().trim().min(2).max(100).optional(),
      postalCode: z
        .string()
        .trim()
        .regex(/^[1-9][0-9]{5}$/, 'Postal code must be a valid 6-digit Indian PIN code')
        .optional(),
      latitude: z
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90')
        .optional()
        .nullable(),
      longitude: z
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180')
        .optional()
        .nullable(),
      isDefault: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one address field must be provided for update',
    }),
});

export const addressIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid address UUID is required'),
  }),
});
