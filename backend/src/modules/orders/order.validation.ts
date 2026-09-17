import { z } from 'zod';

export const calculateOrderSchema = z.object({
  body: z.object({
    vendorId: z.string().uuid('Valid vendor UUID is required'),
    addressId: z.string().uuid('Valid customer delivery address UUID is required'),
    items: z
      .array(
        z.object({
          productId: z.string().uuid('Valid product UUID is required'),
          variantId: z.string().uuid('Valid variant UUID is required').optional().nullable(),
          quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Max quantity per item is 50'),
        })
      )
      .min(1, 'At least one item is required in the cart'),
  }),
});

export const createOrderSchema = z.object({
  body: z.object({
    vendorId: z.string().uuid('Valid vendor UUID is required'),
    addressId: z.string().uuid('Valid customer delivery address UUID is required'),
    items: z
      .array(
        z.object({
          productId: z.string().uuid('Valid product UUID is required'),
          variantId: z.string().uuid('Valid variant UUID is required').optional().nullable(),
          quantity: z.number().int().min(1, 'Quantity must be at least 1').max(50, 'Max quantity per item is 50'),
        })
      )
      .min(1, 'At least one item is required to place an order'),
    customerNotes: z.string().trim().max(500, 'Notes cannot exceed 500 characters').optional().nullable(),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid order UUID is required'),
  }),
  body: z.object({
    status: z.enum(
      ['CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'],
      { errorMap: () => ({ message: 'Invalid order transition status' }) }
    ),
    reason: z.string().trim().max(500, 'Reason cannot exceed 500 characters').optional().nullable(),
  }),
});

export const cancelOrderSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid order UUID is required'),
  }),
  body: z.object({
    reason: z.string().trim().min(3, 'Cancellation reason is required').max(500),
  }),
});

export const orderIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid('Valid order UUID is required'),
  }),
});

export const orderQuerySchema = z.object({
  query: z.object({
    status: z
      .enum(['PENDING', 'CONFIRMED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'])
      .optional(),
    paymentStatus: z.enum(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).optional(),
    deliveryStatus: z.enum(['UNASSIGNED', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'FAILED']).optional(),
    vendorId: z.string().uuid().optional(),
    customerId: z.string().uuid().optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD').optional(),
    page: z.string().transform((v) => Math.max(1, parseInt(v, 10) || 1)).default('1'),
    limit: z.string().transform((v) => Math.min(100, Math.max(1, parseInt(v, 10) || 20))).default('20'),
  }),
});
