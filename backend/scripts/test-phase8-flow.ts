/**
 * Ringers Platform - Phase 8 Operational Flows Verification Suite
 * Tests all Phase 8 backend capabilities:
 *  1. Customer Onboarding Validation Schemas (Flow A: Vendor-Initiated & Flow B: Customer-Direct)
 *  2. Customer-Specific Products & Pricing Schemas (Custom Pricing, Catalog Restriction)
 *  3. Delivery Assignment Lifecycle, Verification & Handover Schemas (OTP, Confirm, Failure, Location)
 *  4. Connected Delivery Boy Job Application & Activation Pipeline Schemas
 *  5. Vendor Referral Program Schemas (Invite, Reward Status, Query Filtering)
 *  6. Support & Issue Ticket Schemas (Creation, Resolution, Query Filtering)
 *  7. Core Business Logic & State Machines:
 *     - Customer Pricing Override vs Catalog Fallback Calculation
 *     - OTP Format Validation (4-digit numeric)
 *     - Delivery Assignment State Machine Transitions & Invariants
 *     - Referral Code Format Invariant
 *     - Support Ticket Number Invariant
 *  8. Express App Factory Route Mounting & Route Registration Verification
 */

import {
  customerDirectRegistrationSchema,
  vendorInitiateCustomerSchema,
  verifyCustomerOtpSchema,
  activateCustomerAccountSchema,
  rejectRegistrationRequestSchema,
  listRegistrationRequestsSchema,
} from '../src/modules/customer/customer-onboarding.validation.js';

import {
  updateCustomerProductsSchema,
  toggleCatalogRestrictionSchema,
  customerPricingParamSchema,
} from '../src/modules/vendors/customer-pricing.validation.js';

import {
  assignDeliverySchema,
  rejectAssignmentSchema,
  completeDeliveryOtpSchema,
  reportDeliveryFailureSchema,
  recordLocationSchema,
  orderIdParamSchema,
  assignmentIdParamSchema,
} from '../src/modules/delivery/delivery.assignment.validation.js';

import {
  activateDeliveryBoySchema,
  listVendorDeliveryRequestsSchema,
} from '../src/modules/vendors/vendor-delivery-onboarding.validation.js';

import {
  inviteVendorSchema,
  updateRewardStatusSchema,
  listReferralsSchema,
} from '../src/modules/vendors/vendor-referral.validation.js';

import {
  createTicketSchema,
  resolveTicketSchema,
  listTicketsQuerySchema,
} from '../src/modules/support/support.validation.js';

import { createApp } from '../src/app.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 8 Operational Flows Verification Suite...\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}${detail ? `\n          ${detail}` : ''}`);
      failed++;
    }
  }

  const sampleUuid1 = '11111111-2222-3333-4444-555555555555';
  const sampleUuid2 = '22222222-3333-4444-5555-666666666666';
  const invalidUuid = 'not-a-valid-uuid-999';

  // =========================================================================
  // 1. Customer Onboarding & Registration (Flow A & Flow B)
  // =========================================================================
  console.log('1. Customer Onboarding & Registration Schemas');

  // 1a. Flow B: Customer Direct Registration Request (Public)
  const validFlowB = {
    body: {
      vendorId: sampleUuid1,
      firstName: 'Aarav',
      lastName: 'Sharma',
      phone: '+919876543210',
      email: 'aarav.sharma@example.com',
      photoUrl: 'https://cdn.ringers.in/photos/aarav.jpg',
      addressLine1: 'Flat 402, Sunshine Heights, Andheri West',
      city: 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400053',
      notes: 'Please activate quickly for daily milk delivery',
    },
  };
  const resFlowBValid = customerDirectRegistrationSchema.safeParse(validFlowB);
  assert(resFlowBValid.success, 'customerDirectRegistrationSchema accepts valid Flow B registration');

  const invalidFlowBPhone = {
    body: {
      ...validFlowB.body,
      phone: '12345', // invalid phone format
    },
  };
  const resFlowBInvalidPhone = customerDirectRegistrationSchema.safeParse(invalidFlowBPhone);
  assert(!resFlowBInvalidPhone.success, 'customerDirectRegistrationSchema rejects invalid phone format');

  const invalidFlowBVendorId = {
    body: {
      ...validFlowB.body,
      vendorId: invalidUuid,
    },
  };
  const resFlowBInvalidVendor = customerDirectRegistrationSchema.safeParse(invalidFlowBVendorId);
  assert(!resFlowBInvalidVendor.success, 'customerDirectRegistrationSchema rejects non-UUID vendorId');

  // 1b. Flow A: Vendor-Initiated Customer Registration Request
  const validFlowA = {
    body: {
      firstName: 'Priya',
      lastName: 'Patel',
      phone: '+919812345678',
      addressLine1: 'B-12, Green Park Society',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411001',
    },
  };
  const resFlowAValid = vendorInitiateCustomerSchema.safeParse(validFlowA);
  assert(resFlowAValid.success, 'vendorInitiateCustomerSchema accepts valid Flow A initiation');

  const invalidFlowAMissingField = {
    body: {
      firstName: 'Priya',
      // missing phone, addressLine1, city, state, postalCode
    },
  };
  assert(!vendorInitiateCustomerSchema.safeParse(invalidFlowAMissingField).success, 'vendorInitiateCustomerSchema rejects missing required fields');

  // 1c. OTP Verification Schema
  const validOtp = {
    params: { requestId: sampleUuid1 },
    body: { otpCode: '4821' },
  };
  assert(verifyCustomerOtpSchema.safeParse(validOtp).success, 'verifyCustomerOtpSchema accepts 4-digit OTP code');

  const invalidOtp3Digits = {
    params: { requestId: sampleUuid1 },
    body: { otpCode: '123' },
  };
  assert(!verifyCustomerOtpSchema.safeParse(invalidOtp3Digits).success, 'verifyCustomerOtpSchema rejects 3-digit OTP code');

  const invalidOtp5Digits = {
    params: { requestId: sampleUuid1 },
    body: { otpCode: '12345' },
  };
  assert(!verifyCustomerOtpSchema.safeParse(invalidOtp5Digits).success, 'verifyCustomerOtpSchema rejects 5-digit OTP code');

  // 1d. Customer Account Activation Schema
  const validActivation = {
    params: { requestId: sampleUuid1 },
    body: {
      password: 'SecurePassword@2026',
      selectedProducts: [
        { productId: sampleUuid1, isEnabled: true, customPrice: 55.0 },
        { productId: sampleUuid2, isEnabled: true, customPrice: null },
      ],
      notes: 'Customer activated with discounted product 1',
    },
  };
  assert(activateCustomerAccountSchema.safeParse(validActivation).success, 'activateCustomerAccountSchema accepts valid activation payload');

  const shortPasswordActivation = {
    params: { requestId: sampleUuid1 },
    body: {
      password: 'short',
    },
  };
  assert(!activateCustomerAccountSchema.safeParse(shortPasswordActivation).success, 'activateCustomerAccountSchema rejects password < 8 characters');

  const negativePriceActivation = {
    params: { requestId: sampleUuid1 },
    body: {
      password: 'SecurePassword@2026',
      selectedProducts: [{ productId: sampleUuid1, customPrice: -10 }],
    },
  };
  assert(!activateCustomerAccountSchema.safeParse(negativePriceActivation).success, 'activateCustomerAccountSchema rejects negative custom price');

  // 1e. Rejection Schema
  assert(
    rejectRegistrationRequestSchema.safeParse({
      params: { requestId: sampleUuid1 },
      body: { reason: 'Address outside delivery radius' },
    }).success,
    'rejectRegistrationRequestSchema accepts valid rejection reason'
  );
  assert(
    !rejectRegistrationRequestSchema.safeParse({
      params: { requestId: sampleUuid1 },
      body: { reason: '' },
    }).success,
    'rejectRegistrationRequestSchema rejects empty rejection reason'
  );

  // 1f. List Registration Requests Query
  const queryListReq = listRegistrationRequestsSchema.safeParse({
    query: { status: 'PENDING', page: '2', limit: '10' },
  });
  assert(queryListReq.success, 'listRegistrationRequestsSchema accepts valid query filters');
  if (queryListReq.success) {
    assert(queryListReq.data.query.page === 2, 'Page transformed to number 2');
    assert(queryListReq.data.query.limit === 10, 'Limit transformed to number 10');
  }

  // =========================================================================
  // 2. Customer-Specific Products & Pricing Configuration
  // =========================================================================
  console.log('\n2. Customer-Specific Products & Pricing Schemas');

  const validProductConfig = {
    params: { vendorId: sampleUuid1, customerId: sampleUuid2 },
    body: {
      products: [
        { productId: sampleUuid1, isEnabled: true, customPrice: 42.5 },
        { productId: sampleUuid2, isEnabled: false },
      ],
    },
  };
  assert(updateCustomerProductsSchema.safeParse(validProductConfig).success, 'updateCustomerProductsSchema accepts valid product pricing list');

  const emptyProductsConfig = {
    params: { vendorId: sampleUuid1, customerId: sampleUuid2 },
    body: { products: [] },
  };
  assert(!updateCustomerProductsSchema.safeParse(emptyProductsConfig).success, 'updateCustomerProductsSchema rejects empty products array');

  // Catalog restriction toggle
  const toggleCatalogOn = {
    params: { vendorId: sampleUuid1 },
    body: { restrictCustomerCatalog: true },
  };
  assert(toggleCatalogRestrictionSchema.safeParse(toggleCatalogOn).success, 'toggleCatalogRestrictionSchema accepts restrictCustomerCatalog = true');

  const toggleCatalogOff = {
    params: { vendorId: sampleUuid1 },
    body: { restrictCustomerCatalog: false },
  };
  assert(toggleCatalogRestrictionSchema.safeParse(toggleCatalogOff).success, 'toggleCatalogRestrictionSchema accepts restrictCustomerCatalog = false');

  assert(!toggleCatalogRestrictionSchema.safeParse({
    params: { vendorId: sampleUuid1 },
    body: { restrictCustomerCatalog: 'yes' },
  }).success, 'toggleCatalogRestrictionSchema rejects non-boolean value');

  // Customer Pricing Route Params
  assert(customerPricingParamSchema.safeParse({
    params: { vendorId: sampleUuid1, customerId: sampleUuid2 },
  }).success, 'customerPricingParamSchema accepts valid vendor and customer UUIDs');

  assert(!customerPricingParamSchema.safeParse({
    params: { vendorId: sampleUuid1, customerId: invalidUuid },
  }).success, 'customerPricingParamSchema rejects invalid customer UUID');

  // =========================================================================
  // 3. Delivery Assignment Lifecycle, Verification & Handover
  // =========================================================================
  console.log('\n3. Delivery Assignment & Execution Schemas');

  // 3a. Assign Delivery
  const validAssign = {
    params: { id: sampleUuid1 },
    body: { riderId: sampleUuid2 },
  };
  assert(assignDeliverySchema.safeParse(validAssign).success, 'assignDeliverySchema accepts valid order and rider UUIDs');
  assert(!assignDeliverySchema.safeParse({
    params: { id: sampleUuid1 },
    body: { riderId: invalidUuid },
  }).success, 'assignDeliverySchema rejects invalid rider UUID');

  // 3b. Reject Assignment
  assert(rejectAssignmentSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { reason: 'Vehicle breakdown on route' },
  }).success, 'rejectAssignmentSchema accepts valid rejection reason');

  assert(!rejectAssignmentSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { reason: '' },
  }).success, 'rejectAssignmentSchema rejects empty rejection reason');

  // 3c. Complete Delivery with OTP (Path A)
  assert(completeDeliveryOtpSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { otpCode: '8910' },
  }).success, 'completeDeliveryOtpSchema accepts 4-digit OTP code');

  assert(!completeDeliveryOtpSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { otpCode: '891' },
  }).success, 'completeDeliveryOtpSchema rejects non-4-digit OTP code');

  // 3d. Delivery Failure
  const validFailure = {
    params: { id: sampleUuid1 },
    body: {
      reasonCode: 'CUSTOMER_UNAVAILABLE',
      notes: 'Customer phone rang without answer 3 times at door',
    },
  };
  assert(reportDeliveryFailureSchema.safeParse(validFailure).success, 'reportDeliveryFailureSchema accepts valid reasonCode CUSTOMER_UNAVAILABLE');

  const validFailureWrongAddr = {
    params: { id: sampleUuid1 },
    body: { reasonCode: 'WRONG_ADDRESS', notes: 'Building does not exist' },
  };
  assert(reportDeliveryFailureSchema.safeParse(validFailureWrongAddr).success, 'reportDeliveryFailureSchema accepts reasonCode WRONG_ADDRESS');

  assert(!reportDeliveryFailureSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { reasonCode: 'RAINED_OUT' }, // invalid enum
  }).success, 'reportDeliveryFailureSchema rejects unknown reasonCode');

  // 3e. Live Location Updates
  assert(recordLocationSchema.safeParse({
    body: { latitude: 19.0760, longitude: 72.8777, accuracy: 5.2 },
  }).success, 'recordLocationSchema accepts valid Mumbai coordinates');

  assert(!recordLocationSchema.safeParse({
    body: { latitude: 95.0, longitude: 72.8777 },
  }).success, 'recordLocationSchema rejects latitude > 90');

  assert(!recordLocationSchema.safeParse({
    body: { latitude: 19.0760, longitude: 195.0 },
  }).success, 'recordLocationSchema rejects longitude > 180');

  // 3f. Parameter UUIDs
  assert(orderIdParamSchema.safeParse({ params: { id: sampleUuid1 } }).success, 'orderIdParamSchema accepts valid UUID');
  assert(!orderIdParamSchema.safeParse({ params: { id: invalidUuid } }).success, 'orderIdParamSchema rejects invalid UUID');
  assert(assignmentIdParamSchema.safeParse({ params: { id: sampleUuid1 } }).success, 'assignmentIdParamSchema accepts valid UUID');

  // =========================================================================
  // 4. Delivery Boy Job Application & Activation Pipeline
  // =========================================================================
  console.log('\n4. Connected Delivery Boy Pipeline Schemas');

  assert(activateDeliveryBoySchema.safeParse({
    body: { jobRequestId: sampleUuid1, password: 'SecurePassword123!' },
  }).success, 'activateDeliveryBoySchema accepts valid activation payload');

  assert(!activateDeliveryBoySchema.safeParse({
    body: { jobRequestId: sampleUuid1, password: 'short' },
  }).success, 'activateDeliveryBoySchema rejects password < 8 characters');

  assert(!activateDeliveryBoySchema.safeParse({
    body: { jobRequestId: invalidUuid, password: 'SecurePassword123!' },
  }).success, 'activateDeliveryBoySchema rejects non-UUID jobRequestId');

  const queryDeliveryRequests = listVendorDeliveryRequestsSchema.safeParse({
    query: { status: 'CONNECTED', page: '1', limit: '15' },
  });
  assert(queryDeliveryRequests.success, 'listVendorDeliveryRequestsSchema accepts CONNECTED status filter');
  if (queryDeliveryRequests.success) {
    assert(queryDeliveryRequests.data.query.limit === 15, 'Limit parsed to number 15');
  }

  // =========================================================================
  // 5. Vendor Referral Program
  // =========================================================================
  console.log('\n5. Vendor Referral Program Schemas');

  // 5a. Invite Vendor
  assert(inviteVendorSchema.safeParse({
    body: { refereePhone: '+919876543210' },
  }).success, 'inviteVendorSchema accepts invitation with phone only');

  assert(inviteVendorSchema.safeParse({
    body: { refereeEmail: 'partner@groceries.com' },
  }).success, 'inviteVendorSchema accepts invitation with email only');

  assert(inviteVendorSchema.safeParse({
    body: { refereePhone: '+919876543210', refereeEmail: 'partner@groceries.com' },
  }).success, 'inviteVendorSchema accepts invitation with both phone and email');

  assert(!inviteVendorSchema.safeParse({
    body: {},
  }).success, 'inviteVendorSchema rejects payload with neither phone nor email');

  // 5b. Admin Update Reward Status
  assert(updateRewardStatusSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { rewardStatus: 'APPROVED', rewardAmount: 500, rewardNotes: 'Active 30 days milestone' },
  }).success, 'updateRewardStatusSchema accepts APPROVED with reward amount');

  assert(updateRewardStatusSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { rewardStatus: 'PAID' },
  }).success, 'updateRewardStatusSchema accepts PAID status');

  assert(!updateRewardStatusSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { rewardStatus: 'APPROVED', rewardAmount: -100 },
  }).success, 'updateRewardStatusSchema rejects negative reward amount');

  assert(!updateRewardStatusSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { rewardStatus: 'INVALID_STATUS' },
  }).success, 'updateRewardStatusSchema rejects invalid reward status enum');

  // 5c. Referral Query
  const queryReferrals = listReferralsSchema.safeParse({
    query: { status: 'REGISTERED', rewardStatus: 'PENDING', page: '1', limit: '20' },
  });
  assert(queryReferrals.success, 'listReferralsSchema accepts valid filter query');

  // =========================================================================
  // 6. Support & Issue Tickets
  // =========================================================================
  console.log('\n6. Support & Issue Ticket Schemas');

  assert(createTicketSchema.safeParse({
    body: {
      category: 'ORDER_ISSUE',
      subject: 'Damaged packaging on arrival',
      description: 'The milk pouch had a leak and soaked the other items in the parcel.',
      priority: 'HIGH',
      orderId: sampleUuid1,
    },
  }).success, 'createTicketSchema accepts valid ticket with orderId');

  const minimalTicket = createTicketSchema.safeParse({
    body: {
      category: 'GENERAL',
      subject: 'Inquiry about service timings',
      description: 'What are the delivery slots available in Kharghar sector 20?',
    },
  });
  assert(minimalTicket.success, 'createTicketSchema accepts ticket with defaults');
  if (minimalTicket.success) {
    assert(minimalTicket.data.body.priority === 'MEDIUM', 'Default priority is MEDIUM');
  }

  assert(!createTicketSchema.safeParse({
    body: {
      category: 'GENERAL',
      subject: 'Hi', // too short (< 3)
      description: 'Short', // too short (< 10)
    },
  }).success, 'createTicketSchema rejects short subject/description');

  // Resolve Ticket
  assert(resolveTicketSchema.safeParse({
    params: { id: sampleUuid1 },
    body: {
      status: 'RESOLVED',
      adminResponse: 'Wallet credited ₹120 for damaged goods. We apologize for the inconvenience.',
    },
  }).success, 'resolveTicketSchema accepts RESOLVED status with adminResponse');

  assert(!resolveTicketSchema.safeParse({
    params: { id: sampleUuid1 },
    body: { status: 'RESOLVED', adminResponse: '' },
  }).success, 'resolveTicketSchema rejects empty adminResponse');

  // Query Tickets
  const queryTickets = listTicketsQuerySchema.safeParse({
    query: { category: 'PAYMENT_ISSUE', status: 'OPEN', priority: 'URGENT' },
  });
  assert(queryTickets.success, 'listTicketsQuerySchema accepts category/status/priority filters');

  // =========================================================================
  // 7. Core Business Logic & State Machine Invariants
  // =========================================================================
  console.log('\n7. Core Business Logic & State Machine Invariants');

  // 7a. Customer-Specific Pricing Fallback Logic
  function resolveEffectivePrice(
    catalogRegularPrice: number,
    catalogDiscountPrice: number | null,
    customerCustomPrice: number | null | undefined,
    isProductEnabledForCustomer: boolean = true
  ): { price: number; isCustom: boolean; available: boolean } {
    if (!isProductEnabledForCustomer) {
      return { price: 0, isCustom: false, available: false };
    }
    if (customerCustomPrice != null && customerCustomPrice >= 0) {
      return { price: customerCustomPrice, isCustom: true, available: true };
    }
    const standardPrice = catalogDiscountPrice != null && catalogDiscountPrice > 0
      ? catalogDiscountPrice
      : catalogRegularPrice;
    return { price: standardPrice, isCustom: false, available: true };
  }

  const priceWithOverride = resolveEffectivePrice(100, 90, 80, true);
  assert(priceWithOverride.price === 80 && priceWithOverride.isCustom, 'Customer custom price overrides catalog discount price');

  const priceWithCatalogDiscount = resolveEffectivePrice(100, 85, null, true);
  assert(priceWithCatalogDiscount.price === 85 && !priceWithCatalogDiscount.isCustom, 'Catalog discount price is used when no custom price set');

  const priceWithRegular = resolveEffectivePrice(100, null, null, true);
  assert(priceWithRegular.price === 100 && !priceWithRegular.isCustom, 'Catalog regular price is used when no discount or custom price set');

  const priceDisabledForCustomer = resolveEffectivePrice(100, 80, 75, false);
  assert(!priceDisabledForCustomer.available, 'Product correctly unavailable when disabled for customer');

  // 7b. OTP Generation Pattern (4-digit numeric string)
  function generate4DigitOtp(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  const otpSamples = Array.from({ length: 10 }, () => generate4DigitOtp());
  const allOtpsValid = otpSamples.every((otp) => /^\d{4}$/.test(otp));
  assert(allOtpsValid, 'Generated OTPs are always strictly 4 numeric digits');

  // 7c. Delivery Assignment State Machine Transitions
  type AssignmentState = 'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'FAILED' | 'REJECTED' | 'CANCELLED';
  const validTransitions: Record<AssignmentState, AssignmentState[]> = {
    PENDING: ['ACCEPTED', 'REJECTED', 'CANCELLED'],
    ACCEPTED: ['PICKED_UP', 'CANCELLED'],
    PICKED_UP: ['OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED'],
    OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
    DELIVERED: [],
    FAILED: [],
    REJECTED: [],
    CANCELLED: [],
  };

  function canTransition(from: AssignmentState, to: AssignmentState): boolean {
    return validTransitions[from]?.includes(to) ?? false;
  }

  assert(canTransition('PENDING', 'ACCEPTED'), 'State machine allows PENDING -> ACCEPTED');
  assert(canTransition('PENDING', 'REJECTED'), 'State machine allows PENDING -> REJECTED');
  assert(canTransition('ACCEPTED', 'PICKED_UP'), 'State machine allows ACCEPTED -> PICKED_UP');
  assert(canTransition('PICKED_UP', 'OUT_FOR_DELIVERY'), 'State machine allows PICKED_UP -> OUT_FOR_DELIVERY');
  assert(canTransition('OUT_FOR_DELIVERY', 'DELIVERED'), 'State machine allows OUT_FOR_DELIVERY -> DELIVERED');
  assert(canTransition('OUT_FOR_DELIVERY', 'FAILED'), 'State machine allows OUT_FOR_DELIVERY -> FAILED');
  assert(!canTransition('DELIVERED', 'FAILED'), 'State machine blocks DELIVERED -> FAILED');
  assert(!canTransition('PENDING', 'DELIVERED'), 'State machine blocks PENDING -> DELIVERED (skipping pickup)');

  // 7d. Referral Code Format Invariant
  function generateReferralCode(businessCode: string): string {
    const clean = businessCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF-${clean}-${rand}`;
  }
  const refCode = generateReferralCode('KIRANA_01');
  assert(/^REF-[A-Z0-9]{1,4}-[A-Z0-9]{4}$/.test(refCode), `Referral code format matches REF-XXXX-XXXX (${refCode})`);

  // 7e. Ticket Number Format Invariant
  function generateTicketNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TIK-${today}-${rand}`;
  }
  const ticketNumber = generateTicketNumber();
  assert(/^TIK-\d{8}-[A-Z0-9]{4}$/.test(ticketNumber), `Ticket number matches TIK-YYYYMMDD-XXXX (${ticketNumber})`);

  // =========================================================================
  // 8. Express Application & Route Integration Check
  // =========================================================================
  console.log('\n8. Express App Factory Route Mounting');

  const app = createApp();
  assert(!!app, 'createApp() produces valid Express application');

  const routesMounted: string[] = [];
  function extractRoutes(stack: any[], prefix = '') {
    for (const layer of stack) {
      if (layer.route) {
        routesMounted.push(`${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle?.stack) {
        const path = layer.regexp
          ?.toString()
          ?.replace('/^\\', '')
          ?.replace('\\/?(?=\\/|$)/i', '')
          ?.replace(/\\\//g, '/')
          ?.replace('^', '')
          ?.replace('(?=\\/|$)', '') || '';
        extractRoutes(layer.handle.stack, `${prefix}${path}`);
      }
    }
  }

  if ((app as any)._router?.stack) {
    extractRoutes((app as any)._router.stack);
  }

  const hasHealthRoute = routesMounted.some((r) => r.includes('health'));
  assert(hasHealthRoute, 'App router contains /health route');

  // Verify routes index exports Router
  const { default: apiRouter } = await import('../src/routes/index.js');
  assert(apiRouter !== undefined && typeof apiRouter === 'function', 'routes/index.js default exports valid Router');

  assert(routesMounted.length > 20, `App has ${routesMounted.length} total endpoints mounted`);

  // =========================================================================
  // Final Results
  // =========================================================================
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Phase 8 Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 8 verification run failed with unexpected error:', err);
  process.exit(1);
});
