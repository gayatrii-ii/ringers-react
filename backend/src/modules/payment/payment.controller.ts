import { Request, Response, NextFunction } from 'express';
import { PaymentService, WalletService } from './payment.service.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES } from '../../constants/roles.js';

export class PaymentController {
  // ==================================================================
  // PAYMENT GATEWAY ENDPOINTS
  // ==================================================================

  /**
   * POST /api/v1/payments/initiate
   * Customer initiates payment for an order via Razorpay
   */
  public static async initiatePayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { orderId, paymentMethod } = req.body;
      const result = await PaymentService.initiatePayment(req.user.userId, orderId, paymentMethod);

      res.status(200).json({
        success: true,
        message: 'Payment order initiated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/verify
   * Customer verifies Razorpay payment signature after frontend checkout
   */
  public static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const result = await PaymentService.verifyPayment(req.user.userId, {
        orderId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      res.status(200).json({
        success: true,
        message: 'Payment verified and captured successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/webhook
   * Razorpay server-to-server event webhook (verified by HMAC SHA256)
   */
  public static async handleWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const rawBody = (req as any).rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
      const signature = (req.headers['x-razorpay-signature'] as string) || '';

      if (!signature) {
        throw new AppError('Missing X-Razorpay-Signature header', 400, 'MISSING_SIGNATURE');
      }

      const result = await PaymentService.handleWebhook(rawBody, signature);

      res.status(200).json({
        success: true,
        message: 'Webhook processed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/order/:orderId
   * Retrieve payment transaction history for an order
   */
  public static async getOrderPayments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const orderId = req.params.orderId as string;
      const isAdmin =
        req.user.roles.includes(ROLES.ADMIN) || req.user.roles.includes(ROLES.SUPER_ADMIN);

      const result = await PaymentService.getOrderPayments(orderId, req.user.userId, isAdmin);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/refund
   * Admin-triggered refund for a paid order (Razorpay refund + customer wallet credit)
   */
  public static async processRefund(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { orderId, reason } = req.body;
      const result = await PaymentService.processRefund(orderId, req.user.userId, reason);

      res.status(200).json({
        success: true,
        message: 'Refund processed and customer wallet credited successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // ==================================================================
  // WALLET ENDPOINTS
  // ==================================================================

  /**
   * GET /api/v1/payments/wallet/balance (or /api/v1/wallet/balance)
   * Get user's wallet balance and active status
   */
  public static async getWalletBalance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const wallet = await WalletService.getBalance(req.user.userId);

      res.status(200).json({
        success: true,
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/wallet/topup (or /api/v1/wallet/topup)
   * Initiate wallet top-up by creating a Razorpay order
   */
  public static async initiateWalletTopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { amount } = req.body;
      const result = await WalletService.initiateTopup(req.user.userId, amount);

      res.status(200).json({
        success: true,
        message: 'Wallet top-up order created successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/wallet/topup/verify (or /api/v1/wallet/topup/verify)
   * Verify top-up payment signature and credit funds to wallet
   */
  public static async verifyWalletTopup(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
      const wallet = await WalletService.verifyTopup(req.user.userId, {
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
      });

      res.status(200).json({
        success: true,
        message: 'Wallet top-up verified and credited successfully',
        data: wallet,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/payments/wallet/pay (or /api/v1/wallet/pay)
   * Pay for an order using wallet balance
   */
  public static async payWithWallet(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { orderId } = req.body;
      const result = await WalletService.payOrderWithWallet(req.user.userId, orderId);

      res.status(200).json({
        success: true,
        message: 'Order paid successfully using wallet balance',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/payments/wallet/transactions (or /api/v1/wallet/transactions)
   * Paginated ledger of wallet transactions
   */
  public static async getWalletTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const type = req.query.type ? String(req.query.type) : undefined;
      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(String(req.query.page || '1'), 10);
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || '20'), 10);

      const result = await WalletService.getTransactionHistory(req.user.userId, {
        type,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
