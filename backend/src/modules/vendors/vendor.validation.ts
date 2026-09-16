import { z } from 'zod';

export const updateVendorProfileSchema = z.object({
  body: z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters').max(200).optional(),
    description: z.string().max(1000).optional(),
    phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format').optional(),
    email: z.string().email('Invalid email address format').optional(),
  }),
});

export const updateVendorStatusSchema = z.object({
  body: z.object({
    status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED'], {
      errorMap: () => ({ message: 'Status must be one of: PENDING_APPROVAL, ACTIVE, SUSPENDED, CLOSED' }),
    }),
  }),
});

export const createVendorAddressSchema = z.object({
  body: z.object({
    addressLine1: z.string().min(3, 'Address line 1 is required').max(255),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(2, 'City is required').max(100),
    state: z.string().min(2, 'State is required').max(100),
    country: z.string().max(100).default('India'),
    postalCode: z.string().min(3, 'Postal code is required').max(20),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isPrimary: z.boolean().default(true),
  }),
});

export const updateVendorAddressSchema = z.object({
  body: z.object({
    addressLine1: z.string().min(3).max(255).optional(),
    addressLine2: z.string().max(255).optional(),
    city: z.string().min(2).max(100).optional(),
    state: z.string().min(2).max(100).optional(),
    country: z.string().max(100).optional(),
    postalCode: z.string().min(3).max(20).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    isPrimary: z.boolean().optional(),
  }),
});

export const addVendorStaffSchema = z.object({
  body: z.object({
    userId: z.string().uuid('Valid user ID UUID is required'),
    designation: z.enum(['OWNER', 'MANAGER', 'STAFF', 'CHEF']).default('STAFF'),
  }),
});

export const vendorQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    city: z.string().optional(),
    status: z.enum(['PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED']).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }).optional(),
});

export type UpdateVendorProfileInput = z.infer<typeof updateVendorProfileSchema>['body'];
export type UpdateVendorStatusInput = z.infer<typeof updateVendorStatusSchema>['body'];
export type CreateVendorAddressInput = z.infer<typeof createVendorAddressSchema>['body'];
export type UpdateVendorAddressInput = z.infer<typeof updateVendorAddressSchema>['body'];
export type AddVendorStaffInput = z.infer<typeof addVendorStaffSchema>['body'];
export type VendorQueryInput = NonNullable<z.infer<typeof vendorQuerySchema>['query']>;
