import { z } from 'zod';

export const customerProductItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  isEnabled: z.boolean().default(true),
  customPrice: z.number().nonnegative('Custom price must be positive or zero').optional().nullable(),
});

export const updateCustomerProductsSchema = z.object({
  products: z.array(customerProductItemSchema).min(1, 'At least one product must be specified'),
});

export const toggleCatalogRestrictionSchema = z.object({
  restrictCustomerCatalog: z.boolean(),
});

export const customerPricingParamSchema = z.object({
  vendorId: z.string().uuid('Invalid vendor ID format'),
  customerId: z.string().uuid('Invalid customer ID format'),
});
