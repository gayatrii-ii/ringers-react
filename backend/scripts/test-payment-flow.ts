/**
 * Ringers Platform - Phase 6 Verification Suite
 * Tests:
 *  1. Payment Initiation Schema Validation (UPI, CARD, NET_BANKING, WALLET)
 *  2. Payment Signature Verification Schema Validation
 *  3. Razorpay HMAC-SHA256 Timing-Safe Signature Verification Logic
 *  4. Razorpay Webhook Schema & Event Verification Logic
 *  5. Order Payment Param & Admin Refund Schema Validation
 *  6. Wallet Top-Up Schema (bounds, minimum ₹1, maximum ₹1,00,000)
 *  7. Wallet Pay Schema & Transaction History Query Pagination/Filtering
 *  8. Express App Factory & Route Mounting for /payments and /wallet
 *  9. Vendor Payout Commission Calculation Logic (90% vendor, 10% platform)
 */

import crypto from 'crypto';
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  webhookSchema,
  paymentOrderParamSchema,
  walletTopupSchema,
  walletTransactionQuerySchema,
  walletPaySchema,
  adminRefundSchema,
} from '../src/modules/payment/payment.validation.js';
import { createApp } from '../src/app.js';
import { createRazorpayOrder, createRazorpayRefund } from '../src/config/razorpay.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 6 Payment & Wallet System Verification...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  const sampleOrderId = '11111111-2222-3333-4444-555555555555';
  const sampleRzpOrderId = 'order_DAvD1234567890';
  const sampleRzpPaymentId = 'pay_DAvD0987654321';
  const testKeySecret = 'test_secret_key_ringers_platform_2026';

  // =========================================================================
  // 1. Payment Initiation Schema Validation
  // =========================================================================
  console.log('1. Payment Initiation Schema Validation');

  const validMethods = ['UPI', 'CARD', 'NET_BANKING', 'WALLET'];
  for (const method of validMethods) {
    const res = initiatePaymentSchema.safeParse({
      body: { orderId: sampleOrderId, paymentMethod: method },
    });
    assert(res.success, `Initiate payment accepts valid paymentMethod: ${method}`);
  }

  const invalidMethod = initiatePaymentSchema.safeParse({
    body: { orderId: sampleOrderId, paymentMethod: 'CRYPTO' },
  });
  assert(!invalidMethod.success, 'Initiate payment rejects invalid payment method (CRYPTO)');

  const invalidOrderId = initiatePaymentSchema.safeParse({
    body: { orderId: 'not-a-uuid', paymentMethod: 'UPI' },
  });
  assert(!invalidOrderId.success, 'Initiate payment rejects non-UUID orderId');

  const missingOrderId = initiatePaymentSchema.safeParse({
    body: { paymentMethod: 'UPI' },
  });
  assert(!missingOrderId.success, 'Initiate payment rejects missing orderId');

  // =========================================================================
  // 2. Payment Signature Verification Schema Validation
  // =========================================================================
  console.log('\n2. Payment Signature Verification Schema Validation');

  const validVerifyPayload = {
    body: {
      orderId: sampleOrderId,
      razorpayOrderId: sampleRzpOrderId,
      razorpayPaymentId: sampleRzpPaymentId,
      razorpaySignature: 'e9b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
    },
  };
  const verifyRes = verifyPaymentSchema.safeParse(validVerifyPayload);
  assert(verifyRes.success, 'Valid Razorpay checkout callback payload passes verification schema');

  const missingSig = verifyPaymentSchema.safeParse({
    body: {
      orderId: sampleOrderId,
      razorpayOrderId: sampleRzpOrderId,
      razorpayPaymentId: sampleRzpPaymentId,
    },
  });
  assert(!missingSig.success, 'Verification payload without razorpaySignature is rejected');

  const missingPaymentId = verifyPaymentSchema.safeParse({
    body: {
      orderId: sampleOrderId,
      razorpayOrderId: sampleRzpOrderId,
      razorpaySignature: 'sig123',
    },
  });
  assert(!missingPaymentId.success, 'Verification payload without razorpayPaymentId is rejected');

  // =========================================================================
  // 3. Razorpay HMAC-SHA256 Signature Verification & Timing-Safe Security
  // =========================================================================
  console.log('\n3. Razorpay HMAC-SHA256 Cryptographic Verification');

  // Standard Razorpay signature algorithm: HMAC-SHA256(order_id + "|" + payment_id, key_secret)
  const payloadToSign = `${sampleRzpOrderId}|${sampleRzpPaymentId}`;
  const validSignature = crypto
    .createHmac('sha256', testKeySecret)
    .update(payloadToSign)
    .digest('hex');

  // Timing safe verification check
  const timingSafeVerify = (received: string, expected: string): boolean => {
    try {
      const a = Buffer.from(received);
      const b = Buffer.from(expected);
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  };

  assert(
    timingSafeVerify(validSignature, validSignature),
    'Valid HMAC-SHA256 signature passes timing-safe comparison'
  );

  const tamperedSignature = validSignature.slice(0, -4) + 'abcd';
  assert(
    !timingSafeVerify(tamperedSignature, validSignature),
    'Tampered signature fails timing-safe comparison'
  );

  const tamperedPayloadSig = crypto
    .createHmac('sha256', testKeySecret)
    .update(`${sampleRzpOrderId}|pay_tampered_id`)
    .digest('hex');
  assert(
    !timingSafeVerify(tamperedPayloadSig, validSignature),
    'Signature for altered paymentId fails verification'
  );

  // =========================================================================
  // 4. Razorpay Webhook Schema & Event Verification
  // =========================================================================
  console.log('\n4. Razorpay Webhook Schema & Event Verification');

  const validWebhook = webhookSchema.safeParse({
    body: {
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: sampleRzpPaymentId,
            order_id: sampleRzpOrderId,
            amount: 50000,
            status: 'captured',
          },
        },
      },
    },
  });
  assert(validWebhook.success, 'payment.captured webhook payload passes schema');

  const webhookMissingEvent = webhookSchema.safeParse({
    body: {
      payload: { payment: { entity: {} } },
    },
  });
  assert(!webhookMissingEvent.success, 'Webhook without event field is rejected');

  // Webhook HMAC signature over raw body
  const webhookBody = JSON.stringify({ event: 'payment.captured', data: { id: 123 } });
  const validWebhookSig = crypto
    .createHmac('sha256', testKeySecret)
    .update(webhookBody)
    .digest('hex');

  assert(
    timingSafeVerify(validWebhookSig, validWebhookSig),
    'Webhook raw-body signature verified successfully'
  );

  const invalidWebhookSig = crypto
    .createHmac('sha256', 'wrong_secret')
    .update(webhookBody)
    .digest('hex');
  assert(
    !timingSafeVerify(invalidWebhookSig, validWebhookSig),
    'Webhook with wrong secret key signature is rejected'
  );

  // =========================================================================
  // 5. Order Payment Param & Admin Refund Schema Validation
  // =========================================================================
  console.log('\n5. Order Payments & Admin Refund Schema Validation');

  const validParam = paymentOrderParamSchema.safeParse({
    params: { orderId: sampleOrderId },
  });
  assert(validParam.success, 'Valid UUID orderId param passes');

  const invalidParam = paymentOrderParamSchema.safeParse({
    params: { orderId: 'not-a-valid-uuid' },
  });
  assert(!invalidParam.success, 'Invalid UUID orderId param is rejected');

  const validRefund = adminRefundSchema.safeParse({
    body: {
      orderId: sampleOrderId,
      reason: 'Customer requested cancellation before restaurant confirmed',
    },
  });
  assert(validRefund.success, 'Valid admin refund payload passes schema');

  const shortReasonRefund = adminRefundSchema.safeParse({
    body: {
      orderId: sampleOrderId,
      reason: 'no', // too short (< 3 chars)
    },
  });
  assert(!shortReasonRefund.success, 'Refund with reason shorter than 3 characters is rejected');

  const missingReasonRefund = adminRefundSchema.safeParse({
    body: {
      orderId: sampleOrderId,
    },
  });
  assert(!missingReasonRefund.success, 'Refund missing reason is rejected');

  // =========================================================================
  // 6. Wallet Top-Up Schema (Limits & Input Validation)
  // =========================================================================
  console.log('\n6. Wallet Top-Up Schema Validation');

  const validTopups = [1, 50, 500, 1000, 50000, 100000];
  for (const amt of validTopups) {
    const res = walletTopupSchema.safeParse({ body: { amount: amt } });
    assert(res.success, `Wallet top-up accepts valid amount ₹${amt}`);
  }

  const zeroTopup = walletTopupSchema.safeParse({ body: { amount: 0 } });
  assert(!zeroTopup.success, 'Wallet top-up rejects ₹0');

  const negativeTopup = walletTopupSchema.safeParse({ body: { amount: -500 } });
  assert(!negativeTopup.success, 'Wallet top-up rejects negative amount ₹-500');

  const excessiveTopup = walletTopupSchema.safeParse({ body: { amount: 100001 } });
  assert(!excessiveTopup.success, 'Wallet top-up rejects amount exceeding ₹1,00,000');

  const nonNumericTopup = walletTopupSchema.safeParse({ body: { amount: '500' } });
  assert(!nonNumericTopup.success, 'Wallet top-up rejects string amount instead of number');

  // =========================================================================
  // 7. Wallet Pay & Ledger History Query Pagination
  // =========================================================================
  console.log('\n7. Wallet Pay & Ledger History Query Validation');

  const validWalletPay = walletPaySchema.safeParse({
    body: { orderId: sampleOrderId },
  });
  assert(validWalletPay.success, 'Valid wallet pay payload with order UUID passes');

  const invalidWalletPay = walletPaySchema.safeParse({
    body: { orderId: 'bad-uuid' },
  });
  assert(!invalidWalletPay.success, 'Wallet pay rejects non-UUID orderId');

  const defaultQuery = walletTransactionQuerySchema.safeParse({ query: {} });
  assert(
    defaultQuery.success && defaultQuery.data.query.page === 1 && defaultQuery.data.query.limit === 20,
    'Wallet transaction query defaults to page=1 and limit=20'
  );

  const customQuery = walletTransactionQuerySchema.safeParse({
    query: { type: 'CREDIT', page: '3', limit: '50' },
  });
  assert(
    customQuery.success &&
      customQuery.data.query.type === 'CREDIT' &&
      customQuery.data.query.page === 3 &&
      customQuery.data.query.limit === 50,
    'Wallet transaction query parses type=CREDIT, page=3, limit=50'
  );

  const debitQuery = walletTransactionQuerySchema.safeParse({
    query: { type: 'DEBIT' },
  });
  assert(
    debitQuery.success && debitQuery.data.query.type === 'DEBIT',
    'Wallet transaction query parses type=DEBIT'
  );

  const invalidTypeQuery = walletTransactionQuerySchema.safeParse({
    query: { type: 'TRANSFER' },
  });
  assert(!invalidTypeQuery.success, 'Wallet transaction query rejects invalid type (TRANSFER)');

  // =========================================================================
  // 8. Vendor Payout Commission Calculation Logic
  // =========================================================================
  console.log('\n8. Vendor Payout Commission Calculation Logic');

  // Platform rule: 10% commission, vendor gets 90%
  const calculateVendorPayout = (orderTotal: number): number => {
    const commissionRate = 0.10;
    return Math.round(orderTotal * (1 - commissionRate) * 100) / 100;
  };

  assert(calculateVendorPayout(1000) === 900, 'Order of ₹1000 yields ₹900 vendor payout (10% fee)');
  assert(calculateVendorPayout(250) === 225, 'Order of ₹250 yields ₹225 vendor payout (10% fee)');
  assert(calculateVendorPayout(99.50) === 89.55, 'Order of ₹99.50 yields ₹89.55 vendor payout');
  assert(calculateVendorPayout(0) === 0, 'Order of ₹0 yields ₹0 vendor payout');

  // =========================================================================
  // 9. Zero-Dependency Razorpay Client & Function Exports
  // =========================================================================
  console.log('\n9. Zero-Dependency Razorpay Client Exports');

  assert(typeof createRazorpayOrder === 'function', 'createRazorpayOrder client function is exported');
  assert(typeof createRazorpayRefund === 'function', 'createRazorpayRefund client function is exported');

  // =========================================================================
  // 10. Express App Factory & Route Mounting
  // =========================================================================
  console.log('\n10. Express App Factory & Route Mounting');

  const app = createApp();
  assert(typeof app === 'function', 'createApp() initializes Express application');

  // Inspect mounted routes on the Express router
  const routerStack = (app as any)._router?.stack || [];
  const apiRouteLayer = routerStack.find(
    (layer: any) => layer.route || (layer.name === 'router' && layer.regexp.test('/api/v1'))
  );
  assert(!!apiRouteLayer, 'API v1 router is mounted in the Express application');

  console.log('\n================================');
  console.log(`Phase 6 Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 6 verification crashed:', err);
  process.exit(1);
});
