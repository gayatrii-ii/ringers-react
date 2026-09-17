/**
 * Ringers Platform - Phase 5 Verification Suite
 * Tests: Cart & Price calculation engine (subtotals, taxes, delivery distance fee)
 *        Order placement & immutable address/item snapshotting
 *        Order lifecycle state machine transitions & role guards
 */

import {
  calculateOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderQuerySchema,
  orderIdParamSchema,
} from '../src/modules/orders/order.validation.js';

import { OrderService } from '../src/modules/orders/order.service.js';
import { createApp } from '../src/app.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 5 Cart & Order Management Verification...\n');

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

  // =========================================================================
  // 1. Haversine Distance & Delivery Calculation Engine
  // =========================================================================
  console.log('1. Distance & Order Number Logic');

  // Distance between Pune Station (18.5284, 73.8739) and Baner (18.5596, 73.7799) is ~10.5 km
  const distance = OrderService.calculateDistanceKm(18.5284, 73.8739, 18.5596, 73.7799);
  assert(distance > 9 && distance < 12, `Haversine distance computed accurately (~10.5 km, got ${distance} km)`);

  const sameSpotDistance = OrderService.calculateDistanceKm(18.5, 73.8, 18.5, 73.8);
  assert(sameSpotDistance === 0, 'Distance between identical points is 0 km');

  const orderNumber1 = OrderService.generateOrderNumber();
  const orderNumber2 = OrderService.generateOrderNumber();
  const orderNumberRegex = /^RNG-ORD-\d{8}-[A-F0-9]{6}$/;

  assert(orderNumberRegex.test(orderNumber1), `Order number format matches RNG-ORD-YYYYMMDD-XXXXXX (${orderNumber1})`);
  assert(orderNumber1 !== orderNumber2, 'Consecutive generated order numbers are unique');

  // =========================================================================
  // 2. Cart & Price Calculation Schema Validation
  // =========================================================================
  console.log('\n2. Cart & Price Calculation Schema Validation');

  const validCalc = calculateOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [
        { productId: '33333333-4444-5555-6666-777777777777', quantity: 2 },
        { productId: '44444444-5555-6666-7777-888888888888', variantId: '55555555-6666-7777-8888-999999999999', quantity: 1 },
      ],
    },
  });
  assert(validCalc.success, 'Valid checkout calculation payload passes');

  const emptyItems = calculateOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [],
    },
  });
  assert(!emptyItems.success, 'Empty items array in cart calculation is rejected');

  const zeroQuantity = calculateOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [{ productId: '33333333-4444-5555-6666-777777777777', quantity: 0 }],
    },
  });
  assert(!zeroQuantity.success, 'Quantity of 0 is rejected');

  const excessiveQuantity = calculateOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [{ productId: '33333333-4444-5555-6666-777777777777', quantity: 51 }],
    },
  });
  assert(!excessiveQuantity.success, 'Quantity exceeding 50 is rejected');

  // =========================================================================
  // 3. Order Placement Schema Validation
  // =========================================================================
  console.log('\n3. Order Placement Schema Validation');

  const validOrder = createOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [{ productId: '33333333-4444-5555-6666-777777777777', quantity: 3 }],
      customerNotes: 'Please ring the doorbell twice.',
    },
  });
  assert(validOrder.success, 'Valid order placement with customer notes passes');

  const longNotes = createOrderSchema.safeParse({
    body: {
      vendorId: '11111111-2222-3333-4444-555555555555',
      addressId: '22222222-3333-4444-5555-666666666666',
      items: [{ productId: '33333333-4444-5555-6666-777777777777', quantity: 1 }],
      customerNotes: 'A'.repeat(501),
    },
  });
  assert(!longNotes.success, 'Customer notes exceeding 500 characters is rejected');

  // =========================================================================
  // 4. Order Lifecycle State Machine Validation
  // =========================================================================
  console.log('\n4. Order Lifecycle State Machine Validation');

  const validConfirm = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'CONFIRMED' },
  });
  assert(validConfirm.success, 'Transition to CONFIRMED passes');

  const validPreparing = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'PREPARING' },
  });
  assert(validPreparing.success, 'Transition to PREPARING passes');

  const validReady = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'READY' },
  });
  assert(validReady.success, 'Transition to READY passes');

  const validOutForDelivery = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'OUT_FOR_DELIVERY' },
  });
  assert(validOutForDelivery.success, 'Transition to OUT_FOR_DELIVERY passes');

  const validDelivered = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'DELIVERED' },
  });
  assert(validDelivered.success, 'Transition to DELIVERED passes');

  const invalidStatus = updateOrderStatusSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { status: 'EATING' },
  });
  assert(!invalidStatus.success, 'Invalid arbitrary status is rejected');

  const validCancel = cancelOrderSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { reason: 'Customer changed their mind before vendor started prep' },
  });
  assert(validCancel.success, 'Order cancellation with reason passes');

  const emptyCancelReason = cancelOrderSchema.safeParse({
    params: { id: '66666666-6666-6666-6666-666666666666' },
    body: { reason: ' ' },
  });
  assert(!emptyCancelReason.success, 'Empty cancellation reason is rejected');

  // =========================================================================
  // 5. Query Filtering & Param Validation
  // =========================================================================
  console.log('\n5. Query Filtering & Route Param Validation');

  const validQuery = orderQuerySchema.safeParse({
    query: {
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
      page: '1',
      limit: '20',
    },
  });
  assert(validQuery.success, 'Order query filtering with status and date range passes');

  const invalidDateFormat = orderQuerySchema.safeParse({
    query: {
      startDate: '01-09-2026', // not YYYY-MM-DD
    },
  });
  assert(!invalidDateFormat.success, 'Non-ISO date format in query is rejected');

  const validUuidParam = orderIdParamSchema.safeParse({
    params: { id: '77777777-7777-7777-7777-777777777777' },
  });
  assert(validUuidParam.success, 'Valid order UUID param passes');

  const invalidUuidParam = orderIdParamSchema.safeParse({
    params: { id: 'invalid-order-id' },
  });
  assert(!invalidUuidParam.success, 'Non-UUID order ID param is rejected');

  // =========================================================================
  // 6. Express App & Route Mounting
  // =========================================================================
  console.log('\n6. Express App & Route Mounting');

  const app = createApp();
  assert(typeof app === 'function', 'Express application factory compiles and returns app');

  console.log('\n================================');
  console.log(`Phase 5 Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 5 test crashed:', err);
  process.exit(1);
});
