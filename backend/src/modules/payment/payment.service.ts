import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { createRazorpayOrder, createRazorpayRefund } from '../../config/razorpay.js';
import { env } from '../../config/env.js';

// ============================================================
// Interfaces
// ============================================================

export interface PaymentTransactionResponse {
  id: string;
  orderId: string;
  userId: string;
  provider: string;
  transactionReference: string | null;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  initiatedAt: Date;
  completedAt: Date | null;
  failedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletResponse {
  id: string;
  userId: string;
  balance: number;
  currency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface WalletTransactionResponse {
  id: string;
  walletId: string;
  transactionType: 'CREDIT' | 'DEBIT';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceType: string;
  referenceId: string | null;
  description: string | null;
  createdAt: Date;
}

// ============================================================
// Payment Service
// ============================================================

export class PaymentService {
  // ------------------------------------------------------------------
  // HELPER: Map DB row → PaymentTransactionResponse
  // ------------------------------------------------------------------
  public static mapTransaction(row: any): PaymentTransactionResponse {
    return {
      id: row.id,
      orderId: row.order_id,
      userId: row.user_id,
      provider: row.provider,
      transactionReference: row.transaction_reference,
      razorpayOrderId: row.razorpay_order_id ?? null,
      razorpayPaymentId: row.razorpay_payment_id ?? null,
      amount: parseFloat(row.amount),
      currency: row.currency,
      status: row.status,
      paymentMethod: row.payment_method,
      initiatedAt: row.initiated_at,
      completedAt: row.completed_at ?? null,
      failedAt: row.failed_at ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ------------------------------------------------------------------
  // HELPER: Map DB row → WalletResponse
  // ------------------------------------------------------------------
  public static mapWallet(row: any): WalletResponse {
    return {
      id: row.id,
      userId: row.user_id,
      balance: parseFloat(row.balance),
      currency: row.currency,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ------------------------------------------------------------------
  // HELPER: Map DB row → WalletTransactionResponse
  // ------------------------------------------------------------------
  public static mapWalletTxn(row: any): WalletTransactionResponse {
    return {
      id: row.id,
      walletId: row.wallet_id,
      transactionType: row.transaction_type,
      amount: parseFloat(row.amount),
      balanceBefore: parseFloat(row.balance_before),
      balanceAfter: parseFloat(row.balance_after),
      referenceType: row.reference_type,
      referenceId: row.reference_id ?? null,
      description: row.description ?? null,
      createdAt: row.created_at,
    };
  }

  // ==================================================================
  // 1. INITIATE RAZORPAY PAYMENT
  // ==================================================================
  /**
   * Creates a Razorpay order for a platform order.
   * Records a INITIATED payment_transaction for audit.
   * Returns razorpay_order_id for the frontend checkout widget.
   *
   * Idempotent: if an INITIATED transaction already exists for this
   * order, returns the existing razorpay_order_id instead of creating
   * a new gateway order (prevents double-charge on retry).
   */
  public static async initiatePayment(
    customerId: string,
    orderId: string,
    paymentMethod: string
  ): Promise<{ transactionId: string; razorpayOrderId: string; amount: number; currency: string; keyId: string }> {
    // 1. Verify the order belongs to the caller and is in PENDING state
    const orderRes = await query(
      `SELECT id, customer_id, total_amount, payment_status, order_number
       FROM order_management.orders
       WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    if (order.customer_id !== customerId) {
      throw new AppError('You are not authorized to pay for this order', 403, 'FORBIDDEN');
    }

    if (order.payment_status === 'SUCCESS') {
      throw new AppError('This order has already been paid', 400, 'ALREADY_PAID');
    }

    if (order.payment_status === 'REFUNDED') {
      throw new AppError('This order has been refunded and cannot be paid again', 400, 'ORDER_REFUNDED');
    }

    // 2. Idempotency: return existing INITIATED transaction if one exists
    const existingTxn = await query(
      `SELECT id, razorpay_order_id, amount, currency
       FROM payment.payment_transactions
       WHERE order_id = $1 AND user_id = $2 AND status = 'INITIATED' AND provider = 'RAZORPAY'
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId, customerId]
    );

    if (existingTxn.rows.length > 0 && existingTxn.rows[0]?.razorpay_order_id) {
      const row = existingTxn.rows[0];
      return {
        transactionId: row.id,
        razorpayOrderId: row.razorpay_order_id,
        amount: parseFloat(row.amount),
        currency: row.currency,
        keyId: env.RAZORPAY_KEY_ID,
      };
    }

    const totalAmount = parseFloat(order.total_amount);
    // Razorpay expects amount in paise (₹1 = 100 paise)
    const amountInPaise = Math.round(totalAmount * 100);

    // 3. Create Razorpay order
    const razorpayOrder = await createRazorpayOrder({
      amount: amountInPaise,
      currency: 'INR',
      receipt: order.order_number,
      notes: { platform_order_id: orderId },
    });

    // 4. Record INITIATED transaction
    const txnRes = await query(
      `INSERT INTO payment.payment_transactions (
         order_id, user_id, provider, razorpay_order_id,
         amount, currency, status, payment_method, initiated_at
       ) VALUES ($1, $2, 'RAZORPAY', $3, $4, 'INR', 'INITIATED', $5, CURRENT_TIMESTAMP)
       RETURNING id`,
      [orderId, customerId, razorpayOrder.id, totalAmount, paymentMethod]
    );

    return {
      transactionId: txnRes.rows[0]!.id,
      razorpayOrderId: razorpayOrder.id,
      amount: totalAmount,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  // ==================================================================
  // 2. VERIFY RAZORPAY SIGNATURE (Client-Side Callback)
  // ==================================================================
  /**
   * Verifies Razorpay HMAC-SHA256 signature after successful payment.
   * On success: marks transaction SUCCESS and order payment_status = PAID.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  public static async verifyPayment(
    customerId: string,
    data: {
      orderId: string;
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ): Promise<PaymentTransactionResponse> {
    const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // 1. Compute expected signature: HMAC-SHA256 of "razorpay_order_id|razorpay_payment_id"
    const keySecret = env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new AppError('Payment gateway is not configured on this server', 500, 'GATEWAY_NOT_CONFIGURED');
    }

    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const receivedBuffer = Buffer.from(razorpaySignature, 'hex');

    const isValid =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isValid) {
      // Log failed attempt but DO NOT expose internal details
      await query(
        `UPDATE payment.payment_transactions
         SET status = 'FAILED', failed_at = CURRENT_TIMESTAMP,
             razorpay_payment_id = $1, razorpay_signature = $2
         WHERE order_id = $3 AND user_id = $4 AND status = 'INITIATED' AND provider = 'RAZORPAY'`,
        [razorpayPaymentId, razorpaySignature, orderId, customerId]
      );
      throw new AppError('Payment signature verification failed. Possible tampered request.', 400, 'SIGNATURE_INVALID');
    }

    // 2. Atomically mark transaction SUCCESS and order payment_status = PAID
    return await withTransaction(async (client) => {
      // Find the INITIATED transaction for this order
      const txnRes = await client.query(
        `SELECT id FROM payment.payment_transactions
         WHERE order_id = $1 AND user_id = $2 AND status = 'INITIATED' AND provider = 'RAZORPAY'
         FOR UPDATE`,
        [orderId, customerId]
      );

      if (txnRes.rows.length === 0) {
        throw new AppError('No pending payment transaction found for this order', 404, 'TRANSACTION_NOT_FOUND');
      }

      const transactionId = txnRes.rows[0].id;

      // Update transaction to SUCCESS
      const updatedTxn = await client.query(
        `UPDATE payment.payment_transactions
         SET status = 'SUCCESS',
             razorpay_payment_id = $1,
             razorpay_order_id = $2,
             razorpay_signature = $3,
             transaction_reference = $1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING *`,
        [razorpayPaymentId, razorpayOrderId, razorpaySignature, transactionId]
      );

      // Update order payment_status to PAID
      await client.query(
        `UPDATE order_management.orders
         SET payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      );

      return PaymentService.mapTransaction(updatedTxn.rows[0]);
    });
  }

  // ==================================================================
  // 3. RAZORPAY WEBHOOK (Server-to-Server, No JWT)
  // ==================================================================
  /**
   * Handles Razorpay server webhooks.
   * Verifies X-Razorpay-Signature against HMAC-SHA256 of raw body.
   * Processes: payment.captured, payment.failed, refund.created
   *
   * Idempotent: silently ignores already-processed events.
   */
  public static async handleWebhook(
    rawBody: string,
    receivedSignature: string
  ): Promise<{ processed: boolean; event: string }> {
    const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new AppError('Webhook secret not configured', 500, 'WEBHOOK_NOT_CONFIGURED');
    }

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(expectedSig), Buffer.from(receivedSignature))) {
      throw new AppError('Webhook signature verification failed', 400, 'WEBHOOK_SIGNATURE_INVALID');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new AppError('Invalid webhook payload', 400, 'INVALID_WEBHOOK_PAYLOAD');
    }

    const event: string = payload.event ?? '';

    if (event === 'payment.captured') {
      const payment = payload?.payload?.payment?.entity;
      if (!payment?.order_id || !payment?.id) return { processed: false, event };

      // Check idempotency: is this event already recorded?
      const check = await query(
        `SELECT id, status FROM payment.payment_transactions
         WHERE razorpay_order_id = $1`,
        [payment.order_id]
      );

      if (check.rows.length > 0 && check.rows[0]?.status === 'SUCCESS') {
        return { processed: true, event }; // Already processed
      }

      await withTransaction(async (client) => {
        await client.query(
          `UPDATE payment.payment_transactions
           SET status = 'SUCCESS',
               razorpay_payment_id = $1,
               transaction_reference = $1,
               completed_at = CURRENT_TIMESTAMP
           WHERE razorpay_order_id = $2 AND status IN ('INITIATED', 'PENDING')`,
          [payment.id, payment.order_id]
        );

        await client.query(
          `UPDATE order_management.orders
           SET payment_status = 'PAID', updated_at = CURRENT_TIMESTAMP
           WHERE id = (
             SELECT order_id FROM payment.payment_transactions
             WHERE razorpay_order_id = $1
             LIMIT 1
           )`,
          [payment.order_id]
        );
      });
    } else if (event === 'payment.failed') {
      const payment = payload?.payload?.payment?.entity;
      if (!payment?.order_id) return { processed: false, event };

      await query(
        `UPDATE payment.payment_transactions
         SET status = 'FAILED',
             razorpay_payment_id = $1,
             failed_at = CURRENT_TIMESTAMP
         WHERE razorpay_order_id = $2 AND status IN ('INITIATED', 'PENDING')`,
        [payment.id ?? null, payment.order_id]
      );
    } else if (event === 'refund.created') {
      const refund = payload?.payload?.refund?.entity;
      if (!refund?.payment_id) return { processed: false, event };

      await query(
        `UPDATE payment.payment_transactions
         SET status = 'REFUNDED'
         WHERE razorpay_payment_id = $1 AND status = 'SUCCESS'`,
        [refund.payment_id]
      );
    }

    return { processed: true, event };
  }

  // ==================================================================
  // 4. GET PAYMENT TRANSACTIONS FOR ORDER
  // ==================================================================
  public static async getOrderPayments(
    orderId: string,
    userId: string,
    isAdmin: boolean
  ): Promise<PaymentTransactionResponse[]> {
    // Verify access
    if (!isAdmin) {
      const orderRes = await query(
        `SELECT customer_id FROM order_management.orders WHERE id = $1`,
        [orderId]
      );
      if (orderRes.rows.length === 0) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }
      if (orderRes.rows[0]?.customer_id !== userId) {
        throw new AppError('You do not have access to view these payment records', 403, 'FORBIDDEN');
      }
    }

    const res = await query(
      `SELECT * FROM payment.payment_transactions
       WHERE order_id = $1
       ORDER BY created_at DESC`,
      [orderId]
    );

    return res.rows.map(PaymentService.mapTransaction);
  }

  // ==================================================================
  // 5. ADMIN REFUND (triggers Razorpay refund + updates records)
  // ==================================================================
  /**
   * Admin-triggered refund for a paid order.
   * - Calls Razorpay refund API
   * - Marks payment_transaction as REFUNDED
   * - Updates order payment_status to REFUNDED
   * - Credits customer wallet with refund amount
   */
  public static async processRefund(
    orderId: string,
    adminUserId: string,
    reason: string
  ): Promise<PaymentTransactionResponse> {
    // 1. Fetch the successful payment transaction
    const txnRes = await query(
      `SELECT pt.*, o.payment_status AS order_payment_status
       FROM payment.payment_transactions pt
       JOIN order_management.orders o ON o.id = pt.order_id
       WHERE pt.order_id = $1 AND pt.status = 'SUCCESS' AND pt.provider = 'RAZORPAY'
       ORDER BY pt.created_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (txnRes.rows.length === 0 || !txnRes.rows[0]) {
      throw new AppError('No successful Razorpay payment found for this order', 404, 'PAYMENT_NOT_FOUND');
    }

    const txn = txnRes.rows[0];

    if (txn.order_payment_status === 'REFUNDED') {
      throw new AppError('This order has already been refunded', 400, 'ALREADY_REFUNDED');
    }

    if (!txn.razorpay_payment_id) {
      throw new AppError('Razorpay payment ID not recorded — cannot process refund', 422, 'REFUND_UNAVAILABLE');
    }

    // 2. Call Razorpay refund API
    const refundAmountPaise = Math.round(parseFloat(txn.amount) * 100);
    await createRazorpayRefund(txn.razorpay_payment_id, {
      amount: refundAmountPaise,
      speed: 'optimum',
      notes: { reason, admin_id: adminUserId, platform_order_id: orderId },
    });

    // 3. Atomically update transaction + order + credit wallet
    return await withTransaction(async (client) => {
      const updatedTxnRes = await client.query(
        `UPDATE payment.payment_transactions
         SET status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING *`,
        [txn.id]
      );

      await client.query(
        `UPDATE order_management.orders
         SET payment_status = 'REFUNDED', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      );

      // Credit refund to customer wallet (fetch order customer_id)
      const orderRes = await client.query(
        `SELECT customer_id FROM order_management.orders WHERE id = $1`,
        [orderId]
      );

      if (orderRes.rows.length > 0 && orderRes.rows[0]) {
        await WalletService.creditWalletInTransaction(
          client,
          orderRes.rows[0].customer_id,
          parseFloat(txn.amount),
          'ORDER_REFUND',
          orderId,
          `Refund for cancelled order — ${reason}`
        );
      }

      return PaymentService.mapTransaction(updatedTxnRes.rows[0]!);
    });
  }
}

// ============================================================
// Wallet Service
// ============================================================

export class WalletService {
  // ------------------------------------------------------------------
  // HELPER: Get or create wallet for a user (lazy creation)
  // ------------------------------------------------------------------
  private static async getOrCreateWallet(userId: string): Promise<{ id: string; balance: number }> {
    // Try to fetch
    const res = await query(
      `SELECT id, balance FROM payment.wallets WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (res.rows.length > 0 && res.rows[0]) {
      return { id: res.rows[0].id, balance: parseFloat(res.rows[0].balance) };
    }

    // Create on first access (lazy initialization)
    const inserted = await query(
      `INSERT INTO payment.wallets (user_id, balance, currency, is_active)
       VALUES ($1, 0.00, 'INR', TRUE)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
       RETURNING id, balance`,
      [userId]
    );

    return { id: inserted.rows[0]!.id, balance: parseFloat(inserted.rows[0]!.balance) };
  }

  // ------------------------------------------------------------------
  // GET WALLET BALANCE
  // ------------------------------------------------------------------
  public static async getBalance(userId: string): Promise<WalletResponse> {
    const res = await query(
      `SELECT * FROM payment.wallets WHERE user_id = $1 AND is_active = TRUE`,
      [userId]
    );

    if (res.rows.length === 0) {
      // Auto-create wallet on first fetch
      await WalletService.getOrCreateWallet(userId);
      const fresh = await query(
        `SELECT * FROM payment.wallets WHERE user_id = $1`,
        [userId]
      );
      return PaymentService.mapWallet(fresh.rows[0]!);
    }

    return PaymentService.mapWallet(res.rows[0]!);
  }

  // ------------------------------------------------------------------
  // WALLET TOPUP (via Razorpay)
  // Initiates a Razorpay order for the topup amount.
  // The verify endpoint handles crediting on success.
  // ------------------------------------------------------------------
  public static async initiateTopup(
    userId: string,
    amountRupees: number
  ): Promise<{ razorpayOrderId: string; amount: number; currency: string; keyId: string }> {
    const amountPaise = Math.round(amountRupees * 100);

    const razorpayOrder = await createRazorpayOrder({
      amount: amountPaise,
      currency: 'INR',
      receipt: `WALLET-TOPUP-${userId.slice(0, 8)}-${Date.now()}`,
      notes: { type: 'WALLET_TOPUP', user_id: userId },
    });

    // Record as INITIATED with a synthetic order_id reference (wallet topup has no order)
    await query(
      `INSERT INTO payment.payment_transactions (
         order_id, user_id, provider, razorpay_order_id,
         amount, currency, status, payment_method, initiated_at
       ) VALUES (
         gen_random_uuid(), $1, 'RAZORPAY', $2, $3, 'INR', 'INITIATED', 'WALLET', CURRENT_TIMESTAMP
       )`,
      [userId, razorpayOrder.id, amountRupees]
    );

    return {
      razorpayOrderId: razorpayOrder.id,
      amount: amountRupees,
      currency: 'INR',
      keyId: env.RAZORPAY_KEY_ID,
    };
  }

  // ------------------------------------------------------------------
  // VERIFY WALLET TOPUP (after successful Razorpay payment)
  // ------------------------------------------------------------------
  public static async verifyTopup(
    userId: string,
    data: {
      razorpayOrderId: string;
      razorpayPaymentId: string;
      razorpaySignature: string;
    }
  ): Promise<WalletResponse> {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;

    // Verify HMAC signature
    const keySecret = env.RAZORPAY_KEY_SECRET;
    const expectedSig = crypto
      .createHmac('sha256', keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest('hex');

    const isValid =
      Buffer.from(expectedSig, 'hex').length === Buffer.from(razorpaySignature, 'hex').length &&
      crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(razorpaySignature, 'hex'));

    if (!isValid) {
      throw new AppError('Wallet top-up payment signature verification failed', 400, 'SIGNATURE_INVALID');
    }

    return await withTransaction(async (client) => {
      // Fetch the amount from the INITIATED transaction
      const txnRes = await client.query(
        `SELECT id, amount FROM payment.payment_transactions
         WHERE razorpay_order_id = $1 AND user_id = $2 AND status = 'INITIATED'
         FOR UPDATE`,
        [razorpayOrderId, userId]
      );

      if (txnRes.rows.length === 0) {
        throw new AppError('No pending top-up transaction found', 404, 'TRANSACTION_NOT_FOUND');
      }

      const txn = txnRes.rows[0];
      const topupAmount = parseFloat(txn.amount);

      // Mark transaction SUCCESS
      await client.query(
        `UPDATE payment.payment_transactions
         SET status = 'SUCCESS',
             razorpay_payment_id = $1,
             razorpay_signature = $2,
             transaction_reference = $1,
             completed_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [razorpayPaymentId, razorpaySignature, txn.id]
      );

      // Credit wallet
      await WalletService.creditWalletInTransaction(
        client,
        userId,
        topupAmount,
        'TOPUP',
        txn.id,
        `Wallet top-up via Razorpay`
      );

      // Return updated wallet
      const walletRes = await client.query(
        `SELECT * FROM payment.wallets WHERE user_id = $1`,
        [userId]
      );
      return PaymentService.mapWallet(walletRes.rows[0]!);
    });
  }

  // ------------------------------------------------------------------
  // PAY FOR ORDER USING WALLET BALANCE
  // ------------------------------------------------------------------
  public static async payOrderWithWallet(
    customerId: string,
    orderId: string,
    pin?: string
  ): Promise<{ transaction: PaymentTransactionResponse; wallet: WalletResponse }> {
    // 1. Validate order
    const orderRes = await query(
      `SELECT id, customer_id, total_amount, payment_status, order_number
       FROM order_management.orders
       WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    if (order.customer_id !== customerId) {
      throw new AppError('You are not authorized to pay for this order', 403, 'FORBIDDEN');
    }

    if (order.payment_status === 'PAID' || order.payment_status === 'SUCCESS') {
      throw new AppError('This order has already been paid', 400, 'ALREADY_PAID');
    }

    const totalAmount = parseFloat(order.total_amount);

    return await withTransaction(async (client) => {
      // 2. Lock wallet row for update
      const walletRes = await client.query(
        `SELECT id, balance, wallet_pin_hash FROM payment.wallets
         WHERE user_id = $1 AND is_active = TRUE
         FOR UPDATE`,
        [customerId]
      );

      if (walletRes.rows.length === 0 || !walletRes.rows[0]) {
        throw new AppError('Wallet not found. Please top up your wallet first.', 404, 'WALLET_NOT_FOUND');
      }

      const wallet = walletRes.rows[0];

      // Verify 4-digit PIN if one is configured
      if (wallet.wallet_pin_hash) {
        if (!pin) {
          throw new AppError('Wallet PIN is required for this transaction.', 400, 'WALLET_PIN_REQUIRED');
        }
        const isPinValid = await bcrypt.compare(pin, wallet.wallet_pin_hash);
        if (!isPinValid) {
          throw new AppError('Invalid wallet PIN.', 401, 'INVALID_WALLET_PIN');
        }
      }

      const currentBalance = parseFloat(wallet.balance);

      if (currentBalance < totalAmount) {
        throw new AppError(
          `Insufficient wallet balance. Available: ₹${currentBalance.toFixed(2)}, Required: ₹${totalAmount.toFixed(2)}`,
          400,
          'INSUFFICIENT_WALLET_BALANCE'
        );
      }

      // 3. Debit wallet
      const newBalance = Math.round((currentBalance - totalAmount) * 100) / 100;

      await client.query(
        `UPDATE payment.wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newBalance, wallet.id]
      );

      // 4. Record wallet transaction ledger entry
      await client.query(
        `INSERT INTO payment.wallet_transactions (
           wallet_id, transaction_type, amount, balance_before, balance_after,
           reference_type, reference_id, description
         ) VALUES ($1, 'DEBIT', $2, $3, $4, 'ORDER_PAYMENT', $5, $6)`,
        [wallet.id, totalAmount, currentBalance, newBalance, orderId, `Payment for order ${order.order_number}`]
      );

      // 5. Insert payment_transaction record
      const txnInsert = await client.query(
        `INSERT INTO payment.payment_transactions (
           order_id, user_id, provider, transaction_reference,
           amount, currency, status, payment_method,
           initiated_at, completed_at
         ) VALUES ($1, $2, 'WALLET', $3, $4, 'INR', 'SUCCESS', 'WALLET', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [orderId, customerId, `WALLET-${orderId.slice(0, 8)}-${Date.now()}`, totalAmount]
      );

      // 6. Update order payment_status to PAID and payment_method to WALLET
      await client.query(
        `UPDATE order_management.orders
         SET payment_status = 'PAID', payment_method = 'WALLET', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      );

      // 7. Return updated wallet
      const updatedWalletRes = await client.query(
        `SELECT * FROM payment.wallets WHERE id = $1`,
        [wallet.id]
      );

      return {
        transaction: PaymentService.mapTransaction(txnInsert.rows[0]!),
        wallet: PaymentService.mapWallet(updatedWalletRes.rows[0]!),
      };
    });
  }

  // ------------------------------------------------------------------
  // CREDIT WALLET (internal helper used in transactions)
  // Must be called inside an existing withTransaction block.
  // ------------------------------------------------------------------
  public static async creditWalletInTransaction(
    client: any,
    userId: string,
    amountRupees: number,
    referenceType: string,
    referenceId: string | null,
    description: string
  ): Promise<void> {
    // Upsert wallet with lock
    await client.query(
      `INSERT INTO payment.wallets (user_id, balance, currency, is_active)
       VALUES ($1, 0.00, 'INR', TRUE)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const walletRes = await client.query(
      `SELECT id, balance FROM payment.wallets WHERE user_id = $1 AND is_active = TRUE FOR UPDATE`,
      [userId]
    );

    if (walletRes.rows.length === 0) {
      throw new AppError('Wallet not found for credit operation', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = walletRes.rows[0];
    const balanceBefore = parseFloat(wallet.balance);
    const balanceAfter = Math.round((balanceBefore + amountRupees) * 100) / 100;

    await client.query(
      `UPDATE payment.wallets SET balance = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [balanceAfter, wallet.id]
    );

    await client.query(
      `INSERT INTO payment.wallet_transactions (
         wallet_id, transaction_type, amount, balance_before, balance_after,
         reference_type, reference_id, description
       ) VALUES ($1, 'CREDIT', $2, $3, $4, $5, $6, $7)`,
      [wallet.id, amountRupees, balanceBefore, balanceAfter, referenceType, referenceId, description]
    );
  }

  // ------------------------------------------------------------------
  // VENDOR CREDIT: Called by order completion to credit vendor
  // ------------------------------------------------------------------
  /**
   * Credits vendor wallet when order is DELIVERED.
   * Called from order status transition hook.
   * Amount: order total minus platform commission (default 10%).
   */
  public static async creditVendorOnDelivery(orderId: string): Promise<void> {
    const orderRes = await query(
      `SELECT o.total_amount, o.payment_status, o.delivery_status,
              v.owner_user_id AS vendor_user_id, o.order_number
       FROM order_management.orders o
       JOIN vendor.vendors v ON v.id = o.vendor_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) return;

    const order = orderRes.rows[0];

    // Only credit if payment was collected
    if (order.payment_status !== 'PAID') return;

    // Check if vendor already credited (idempotent check)
    const alreadyCredited = await query(
      `SELECT id FROM payment.wallet_transactions
       WHERE reference_type = 'VENDOR_CREDIT' AND reference_id = $1
       LIMIT 1`,
      [orderId]
    );

    if (alreadyCredited.rows.length > 0) return; // Already processed

    const totalAmount = parseFloat(order.total_amount);
    const commissionRate = 0.10; // 10% platform fee
    const vendorCreditAmount = Math.round(totalAmount * (1 - commissionRate) * 100) / 100;

    await withTransaction(async (client) => {
      await WalletService.creditWalletInTransaction(
        client,
        order.vendor_user_id,
        vendorCreditAmount,
        'VENDOR_CREDIT',
        orderId,
        `Order ${order.order_number} delivered — vendor payout (90% after 10% platform fee)`
      );
    });
  }

  // ------------------------------------------------------------------
  // PAGINATED WALLET TRANSACTION HISTORY
  // ------------------------------------------------------------------
  public static async getTransactionHistory(
    userId: string,
    filter: { type?: string; page: number; limit: number }
  ): Promise<{ transactions: WalletTransactionResponse[]; total: number; page: number; limit: number; balance: number }> {
    // Ensure wallet exists
    const wallet = await WalletService.getOrCreateWallet(userId);

    const conditions: string[] = ['wt.wallet_id = $1'];
    const params: unknown[] = [wallet.id];
    let pIdx = 2;

    if (filter.type) {
      conditions.push(`wt.transaction_type = $${pIdx++}`);
      params.push(filter.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM payment.wallet_transactions wt ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(filter.limit);
    params.push((filter.page - 1) * filter.limit);

    const txnRes = await query(
      `SELECT wt.*
       FROM payment.wallet_transactions wt
       ${whereClause}
       ORDER BY wt.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    return {
      transactions: txnRes.rows.map(PaymentService.mapWalletTxn),
      total,
      page: filter.page,
      limit: filter.limit,
      balance: wallet.balance,
    };
  }

  // ------------------------------------------------------------------
  // WALLET PIN MANAGEMENT
  // ------------------------------------------------------------------
  public static async setWalletPin(userId: string, pin: string): Promise<{ message: string }> {
    const wallet = await WalletService.getOrCreateWallet(userId);
    const pinHash = await bcrypt.hash(pin, 10);

    await query(
      `UPDATE payment.wallets SET wallet_pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [pinHash, wallet.id]
    );

    return { message: 'Wallet PIN set successfully.' };
  }

  public static async changeWalletPin(
    userId: string,
    oldPin: string,
    newPin: string
  ): Promise<{ message: string }> {
    const walletRes = await query<{ id: string; wallet_pin_hash: string | null }>(
      `SELECT id, wallet_pin_hash FROM payment.wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (walletRes.rows.length === 0 || !walletRes.rows[0]) {
      throw new AppError('Wallet not found.', 404, 'WALLET_NOT_FOUND');
    }

    const wallet = walletRes.rows[0];

    if (!wallet.wallet_pin_hash) {
      throw new AppError('No wallet PIN has been set yet. Please use set-pin first.', 400, 'NO_PIN_SET');
    }

    const isMatch = await bcrypt.compare(oldPin, wallet.wallet_pin_hash);
    if (!isMatch) {
      throw new AppError('Incorrect old PIN.', 401, 'INVALID_OLD_PIN');
    }

    const newPinHash = await bcrypt.hash(newPin, 10);
    await query(
      `UPDATE payment.wallets SET wallet_pin_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [newPinHash, wallet.id]
    );

    return { message: 'Wallet PIN updated successfully.' };
  }

  // ------------------------------------------------------------------
  // UNIFIED PAYMENT HISTORY (Cash, Wallet, Online)
  // ------------------------------------------------------------------
  public static async getUnifiedPaymentHistory(
    userId: string,
    options: { page: number; limit: number }
  ): Promise<{
    history: Array<{
      id: string;
      orderId: string | null;
      orderNumber: string | null;
      amount: number;
      method: string;
      status: string;
      createdAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (options.page - 1) * options.limit;

    const countRes = await query<{ count: string }>(
      `SELECT (
        (SELECT COUNT(*) FROM payment.payment_transactions WHERE user_id = $1)
        +
        (SELECT COUNT(*) FROM order_management.orders WHERE customer_id = $1 AND payment_method IN ('CASH', 'CASH_ON_DELIVERY'))
      )::text as count`,
      [userId]
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT 
         pt.id::text,
         pt.order_id::text,
         o.order_number,
         pt.amount,
         pt.payment_method AS method,
         pt.status,
         pt.created_at
       FROM payment.payment_transactions pt
       LEFT JOIN order_management.orders o ON o.id = pt.order_id
       WHERE pt.user_id = $1
       
       UNION ALL
       
       SELECT 
         o.id::text AS id,
         o.id::text AS order_id,
         o.order_number,
         o.total_amount AS amount,
         o.payment_method AS method,
         o.payment_status AS status,
         o.created_at
       FROM order_management.orders o
       WHERE o.customer_id = $1 AND o.payment_method IN ('CASH', 'CASH_ON_DELIVERY')
       
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, options.limit, offset]
    );

    const history = res.rows.map((r) => ({
      id: r.id,
      orderId: r.order_id || null,
      orderNumber: r.order_number || null,
      amount: parseFloat(r.amount || '0'),
      method: r.method,
      status: r.status,
      createdAt: r.created_at,
    }));

    return { history, total, page: options.page, limit: options.limit };
  }

  // ------------------------------------------------------------------
  // REFUND ELIGIBILITY INSPECTION
  // ------------------------------------------------------------------
  public static async checkRefundEligibility(
    orderId: string,
    requesterUserId: string,
    isAdmin: boolean
  ): Promise<{
    eligible: boolean;
    reason?: string;
    orderId: string;
    orderNumber: string;
    orderStatus: string;
    paymentStatus: string;
    paymentMethod: string;
    refundableAmount: number;
  }> {
    const orderRes = await query<{
      id: string;
      order_number: string;
      customer_id: string;
      status: string;
      payment_status: string;
      payment_method: string;
      total_amount: string;
    }>(
      `SELECT id, order_number, customer_id, status, payment_status, payment_method, total_amount
       FROM order_management.orders
       WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found.', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    if (!isAdmin && order.customer_id !== requesterUserId) {
      throw new AppError('You do not have permission to check refund eligibility for this order.', 403, 'FORBIDDEN');
    }

    const totalAmount = parseFloat(order.total_amount || '0');

    if (order.payment_status === 'REFUNDED') {
      return {
        eligible: false,
        reason: 'Order has already been refunded.',
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        refundableAmount: 0,
      };
    }

    if (order.payment_status !== 'PAID' && order.payment_status !== 'SUCCESS') {
      return {
        eligible: false,
        reason: 'Order is not paid, no refund applicable.',
        orderId: order.id,
        orderNumber: order.order_number,
        orderStatus: order.status,
        paymentStatus: order.payment_status,
        paymentMethod: order.payment_method,
        refundableAmount: 0,
      };
    }

    return {
      eligible: true,
      orderId: order.id,
      orderNumber: order.order_number,
      orderStatus: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      refundableAmount: totalAmount,
    };
  }
}

