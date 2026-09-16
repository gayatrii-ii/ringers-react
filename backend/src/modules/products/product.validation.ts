import { z } from 'zod';

export const createProductVariantInputSchema = z.object({
  name: z.string().min(1, 'Variant name is required').max(100),
  sku: z.string().min(2, 'Variant SKU is required').max(100),
  price: z.number().nonnegative('Variant price cannot be negative'),
  status: z.enum(['AVAILABLE', 'OUT_OF_STOCK']).default('AVAILABLE'),
});

export const addProductImageInputSchema = z.object({
  imageUrl: z.string().url('Valid image URL is required').max(500),
  sortOrder: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export const createProductSchema = z.object({
  body: z
    .object({
      name: z.string().min(2, 'Product name must be at least 2 characters').max(200),
      categoryId: z.string().uuid('Valid category ID UUID is required').nullable().optional(),
      sku: z.string().min(2, 'SKU must be at least 2 characters').max(100),
      description: z.string().max(2000).optional(),
      price: z.number().nonnegative('Price cannot be negative'),
      discountPrice: z.number().nonnegative('Discount price cannot be negative').nullable().optional(),
      taxRate: z.number().nonnegative('Tax rate cannot be negative').default(0.0),
      status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED']).default('AVAILABLE'),
      variants: z.array(createProductVariantInputSchema).optional(),
      images: z.array(addProductImageInputSchema).optional(),
    })
    .refine(
      (data) => {
        if (data.discountPrice !== null && data.discountPrice !== undefined) {
          return data.discountPrice <= data.price;
        }
        return true;
      },
      {
        message: 'Discount price must be less than or equal to the regular price',
        path: ['discountPrice'],
      }
    ),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(200).optional(),
      categoryId: z.string().uuid().nullable().optional(),
      description: z.string().max(2000).optional(),
      price: z.number().nonnegative().optional(),
      discountPrice: z.number().nonnegative().nullable().optional(),
      taxRate: z.number().nonnegative().optional(),
      status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED']).optional(),
    })
    .refine(
      (data) => {
        if (
          data.discountPrice !== null &&
          data.discountPrice !== undefined &&
          data.price !== undefined
        ) {
          return data.discountPrice <= data.price;
        }
        return true;
      },
      {
        message: 'Discount price must be less than or equal to regular price',
        path: ['discountPrice'],
      }
    ),
});

export const updateProductStatusSchema = z.object({
  body: z.object({
    status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED'], {
      errorMap: () => ({ message: 'Status must be AVAILABLE, OUT_OF_STOCK, or DISCONTINUED' }),
    }),
  }),
});

export const createProductVariantSchema = z.object({
  body: createProductVariantInputSchema,
});

export const updateProductVariantSchema = z.object({
  body: createProductVariantInputSchema.partial(),
});

export const addProductImageSchema = z.object({
  body: addProductImageInputSchema,
});

export const productQuerySchema = z.object({
  query: z.object({
    search: z.string().optional(),
    vendorId: z.string().uuid().optional(),
    categoryId: z.string().uuid().optional(),
    status: z.enum(['AVAILABLE', 'OUT_OF_STOCK', 'DISCONTINUED']).optional(),
    minPrice: z.coerce.number().optional(),
    maxPrice: z.coerce.number().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  }).optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>['body'];
export type UpdateProductInput = z.infer<typeof updateProductSchema>['body'];
export type UpdateProductStatusInput = z.infer<typeof updateProductStatusSchema>['body'];
export type CreateProductVariantInput = z.infer<typeof createProductVariantSchema>['body'];
export type UpdateProductVariantInput = z.infer<typeof updateProductVariantSchema>['body'];
export type AddProductImageInput = z.infer<typeof addProductImageSchema>['body'];
export type ProductQueryInput = NonNullable<z.infer<typeof productQuerySchema>['query']>;
