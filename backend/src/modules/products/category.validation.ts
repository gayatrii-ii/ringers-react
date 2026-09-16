import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Category name must be at least 2 characters').max(100),
    slug: z.string().min(2).max(120).optional(),
    parentId: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  }),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100).optional(),
    slug: z.string().min(2).max(120).optional(),
    parentId: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
    description: z.string().max(500).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }),
});

export const categoryQuerySchema = z.object({
  query: z.object({
    flat: z.enum(['true', 'false']).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  }).optional(),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>['body'];
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>['body'];
export type CategoryQueryInput = NonNullable<z.infer<typeof categoryQuerySchema>['query']>;
