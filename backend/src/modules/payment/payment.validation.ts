import { z } from 'zod';

// ================================================================
// Payment Gateway Schemas
// ================================================================

/**
 * POST /api/v1/payments/initiate
 * Customer initiates payment for a placed order via Razorpay
 */
export const initiatePaymentSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order UUID is required'),
    paymentMethod: z.enum(['UPI', 'CARD', 'NET_BANKING', 'WALLET'], {
      errorMap: () => ({ message: 'paymentMethod must be UPI, CARD, NET_BANKING, or WALLET' }),
    }),
  }),
});

/**
 * POST /api/v1/payments/verify
 * Customer-side callback: verify Razorpay signature after successful payment
 */
export const verifyPaymentSchema = z.object({
  body: z.object({
    razorpayOrderId: z.string().min(1, 'razorpayOrderId is required'),
    razorpayPaymentId: z.string().min(1, 'razorpayPaymentId is required'),
    razorpaySignature: z.string().min(1, 'razorpaySignature is required'),
    orderId: z.string().uuid('Valid platform order UUID is required'),
  }),
});

/**
 * POST /api/v1/payments/webhook
 * Razorpay server-to-server event webhook (no JWT — verified by HMAC signature)
 */
export const webhookSchema = z.object({
  body: z.object({
    event: z.string().min(1, 'Webhook event type is required'),
    payload: z.record(z.unknown()),
  }),
});

/**
 * GET /api/v1/payments/order/:orderId
 * Get payment transaction(s) for a given order
 */
export const paymentOrderParamSchema = z.object({
  params: z.object({
    orderId: z.string().uuid('Valid order UUID is required'),
  }),
});

// ================================================================
// Wallet Schemas
// ================================================================

/**
 * POST /api/v1/wallet/topup
 * Customer adds funds to their wallet via Razorpay
 */
export const walletTopupSchema = z.object({
  body: z.object({
    amount: z
      .number({ invalid_type_error: 'Amount must be a number' })
      .min(1, 'Minimum top-up amount is ₹1')
      .max(100000, 'Maximum single top-up is ₹1,00,000'),
  }),
});

/**
 * GET /api/v1/wallet/transactions
 * Paginated wallet ledger history
 */
export const walletTransactionQuerySchema = z.object({
  query: z.object({
    type: z.enum(['CREDIT', 'DEBIT']).optional(),
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

/**
 * POST /api/v1/wallet/pay
 * Customer pays for an order using their wallet balance
 */
export const walletPaySchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order UUID is required'),
  }),
});

/**
 * POST /api/v1/payments/refund (Admin-triggered refund)
 */
export const adminRefundSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Valid order UUID is required'),
    reason: z.string().trim().min(3, 'Reason is required').max(500, 'Reason cannot exceed 500 characters'),
  }),
});
