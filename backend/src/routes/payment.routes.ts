import { Router } from 'express';
import { PaymentController } from '../modules/payment/payment.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  paymentOrderParamSchema,
  walletTopupSchema,
  walletTransactionQuerySchema,
  walletPaySchema,
  adminRefundSchema,
  setWalletPinSchema,
  changeWalletPinSchema,
  unifiedPaymentHistoryQuerySchema,
  refundEligibilityParamSchema,
} from '../modules/payment/payment.validation.js';

// ====================================================================
// Wallet Router (can be used directly under /api/v1/wallet or /api/v1/payments/wallet)
// ====================================================================
export const walletRouter = Router();

// Wallet balance (Customer, Vendor, Admin)
walletRouter.get(
  '/balance',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.VENDOR, ROLES.SUPER_ADMIN),
  PaymentController.getWalletBalance
);

// Initiate wallet topup via Razorpay (Customer)
walletRouter.post(
  '/topup',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(walletTopupSchema),
  PaymentController.initiateWalletTopup
);

// Verify wallet topup signature & credit balance (Customer)
walletRouter.post(
  '/topup/verify',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(verifyPaymentSchema),
  PaymentController.verifyWalletTopup
);

// Pay for an order using wallet funds (Customer)
walletRouter.post(
  '/pay',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(walletPaySchema),
  PaymentController.payWithWallet
);

// Set initial wallet 4-digit PIN (Customer)
walletRouter.post(
  '/pin',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(setWalletPinSchema),
  PaymentController.setWalletPin
);

// Change wallet 4-digit PIN (Customer)
walletRouter.patch(
  '/pin',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(changeWalletPinSchema),
  PaymentController.changeWalletPin
);

// Transaction ledger history (Customer, Vendor)
walletRouter.get(
  '/transactions',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(walletTransactionQuerySchema),
  PaymentController.getWalletTransactions
);

// ====================================================================
// Main Payment Gateway Router
// ====================================================================
const paymentRouter = Router();

/**
 * 1. Webhook endpoint: Server-to-server callback from Razorpay
 * NOTE: Must NOT require JWT authentication; verified by HMAC SHA-256 signature
 */
paymentRouter.post('/webhook', PaymentController.handleWebhook);

/**
 * 2. Customer payment operations (Razorpay order checkout)
 */
paymentRouter.post(
  '/initiate',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(initiatePaymentSchema),
  PaymentController.initiatePayment
);

paymentRouter.post(
  '/verify',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(verifyPaymentSchema),
  PaymentController.verifyPayment
);

/**
 * 3. Payment history per order
 */
paymentRouter.get(
  '/order/:orderId',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate(paymentOrderParamSchema),
  PaymentController.getOrderPayments
);

/**
 * 4. Admin Refund processing
 */
paymentRouter.post(
  '/refund',
  authenticateToken,
  requireRoles(ROLES.ADMIN, ROLES.SUPER_ADMIN),
  validate(adminRefundSchema),
  PaymentController.processRefund
);

/**
 * 5. Pre-flight refund eligibility check
 */
paymentRouter.get(
  '/refund-eligibility/:orderId',
  authenticateToken,
  validate(refundEligibilityParamSchema),
  PaymentController.checkRefundEligibility
);

/**
 * 6. Unified customer payment history
 */
paymentRouter.get(
  '/my-history',
  authenticateToken,
  validate(unifiedPaymentHistoryQuerySchema),
  PaymentController.getUnifiedPaymentHistory
);

/**
 * 7. Mount wallet sub-router under /payments/wallet as well
 */
paymentRouter.use('/wallet', walletRouter);

export default paymentRouter;
