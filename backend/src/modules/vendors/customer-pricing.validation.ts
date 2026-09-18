import { z } from 'zod';

// ─── Item schema for product configuration ─────────────────────────────────
const customerProductItemSchema = z.object({
  productId: z.string().uuid('Invalid product ID format'),
  isEnabled: z.boolean().default(true),
  customPrice: z.number().nonnegative('Custom price must be positive or zero').optional().nullable(),
});

// ─── PUT /vendors/:vendorId/customers/:customerId/products ─────────────────
export const updateCustomerProductsSchema = z.object({
  body: z.object({
    products: z.array(customerProductItemSchema).min(1, 'At least one product must be specified'),
  }),
});

// ─── PATCH /vendors/:vendorId/catalog-restriction ─────────────────────────
export const toggleCatalogRestrictionSchema = z.object({
  body: z.object({
    restrictCustomerCatalog: z.boolean(),
  }),
  params: z.object({
    vendorId: z.string().uuid('Invalid vendor ID format'),
  }),
});

// ─── Params for routes with :vendorId and :customerId ─────────────────────
export const customerPricingParamSchema = z.object({
  params: z.object({
    vendorId: z.string().uuid('Invalid vendor ID format'),
    customerId: z.string().uuid('Invalid customer ID format'),
  }),
});
