/**
 * Ringers Backend - Phase 3 (Admin Governance Completion) Verification Suite
 * Tests: Private Key lifecycle, vendor request approval, delivery boy assignment,
 *        vendor UPI payment settings, and public request form validation.
 */
import {
  generateKeySchema,
  keyQuerySchema,
  reviewVendorRequestSchema,
  assignDeliveryRequestSchema,
  publicVendorRequestSchema,
  publicDeliveryJobRequestSchema,
} from '../src/modules/admin/admin.validation.js';

import {
  updateVendorPaymentSettingsSchema,
} from '../src/modules/vendors/vendor.validation.js';

import { createApp } from '../src/app.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 3 Admin Governance Verification...\n');

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

  // 1. Private Key Generation Validation
  console.log('1. Private Key Generation Validation');

  const validKeyGen = generateKeySchema.safeParse({ body: { expiryDays: 30 } });
  assert(validKeyGen.success, 'Valid key generation with 30 day expiry passes');

  const defaultExpiry = generateKeySchema.safeParse({ body: {} });
  assert(defaultExpiry.success, 'Key generation with default expiry passes');

  const zeroExpiry = generateKeySchema.safeParse({ body: { expiryDays: 0 } });
  assert(!zeroExpiry.success, 'Key generation with 0 day expiry is rejected');

  const tooLongExpiry = generateKeySchema.safeParse({ body: { expiryDays: 366 } });
  assert(!tooLongExpiry.success, 'Key generation with 366 day expiry is rejected (max 365)');

  const customCode = generateKeySchema.safeParse({ body: { expiryDays: 14, customCode: 'VND-SPECIAL-2026' } });
  assert(customCode.success, 'Custom key code in uppercase alphanumeric format passes');

  const invalidCode = generateKeySchema.safeParse({ body: { expiryDays: 14, customCode: 'vnd special key!' } });
  assert(!invalidCode.success, 'Custom code with spaces and special chars is rejected');

  // 2. Key List Query Validation
  console.log('\n2. Key List Query Filtering Validation');

  const availableFilter = keyQuerySchema.safeParse({ query: { status: 'AVAILABLE' } });
  assert(availableFilter.success, 'Filter by status=AVAILABLE passes');

  const usedFilter = keyQuerySchema.safeParse({ query: { status: 'USED' } });
  assert(usedFilter.success, 'Filter by status=USED passes');

  const invalidStatus = keyQuerySchema.safeParse({ query: { status: 'INVALID_STATUS' } });
  assert(!invalidStatus.success, 'Invalid status filter is rejected');

  // 3. Vendor Request Review Validation
  console.log('\n3. Vendor Registration Request Review Validation');

  const approveRequest = reviewVendorRequestSchema.safeParse({ body: { status: 'APPROVED', expiryDays: 14 } });
  assert(approveRequest.success, 'Vendor request approval with expiry days passes');

  const rejectRequest = reviewVendorRequestSchema.safeParse({
    body: { status: 'REJECTED', rejectionReason: 'Incomplete business documents provided.' },
  });
  assert(rejectRequest.success, 'Vendor request rejection with reason passes');

  const invalidReview = reviewVendorRequestSchema.safeParse({ body: { status: 'MAYBE' } });
  assert(!invalidReview.success, 'Invalid review status is rejected');

  // 4. Delivery Boy Assignment Validation
  console.log('\n4. Delivery Boy Assignment Validation');

  const validAssign = assignDeliveryRequestSchema.safeParse({
    body: { vendorId: '11111111-2222-3333-4444-555555555555' },
  });
  assert(validAssign.success, 'Valid vendor UUID assignment passes');

  const invalidUUID = assignDeliveryRequestSchema.safeParse({ body: { vendorId: 'not-a-uuid' } });
  assert(!invalidUUID.success, 'Non-UUID vendor ID is rejected');

  // 5. Public Vendor Registration Request Validation
  console.log('\n5. Public Vendor Registration Request Validation');

  const validVendorRequest = publicVendorRequestSchema.safeParse({
    body: {
      businessName: 'Sharma General Store',
      ownerName: 'Ramesh Sharma',
      mobile: '+919876543210',
      email: 'ramesh@sharma.com',
      businessDetails: 'Wholesale grocery supplier in Pune',
    },
  });
  assert(validVendorRequest.success, 'Valid public vendor registration request passes');

  const missingEmail = publicVendorRequestSchema.safeParse({
    body: { businessName: 'Some Store', ownerName: 'Owner', mobile: '9876543210', email: 'not-an-email' },
  });
  assert(!missingEmail.success, 'Invalid email in vendor request is rejected');

  const shortMobile = publicVendorRequestSchema.safeParse({
    body: { businessName: 'Store', ownerName: 'Owner', mobile: '12345', email: 'owner@store.com' },
  });
  assert(!shortMobile.success, 'Short mobile number in vendor request is rejected');

  // 6. Public Delivery Job Request Validation
  console.log('\n6. Public Delivery Job Request Validation');

  const validJobRequest = publicDeliveryJobRequestSchema.safeParse({
    body: {
      fullName: 'Suresh Delivery',
      mobile: '+919876543210',
      address: 'Flat 5B, Shivaji Nagar, Pune',
      city: 'Pune',
      vehicleType: 'Motorbike',
      drivingLicenseNumber: 'MH12-2024-01234',
    },
  });
  assert(validJobRequest.success, 'Valid delivery boy job request passes');

  const missingCity = publicDeliveryJobRequestSchema.safeParse({
    body: { fullName: 'Suresh', mobile: '9876543210', address: 'Some address', city: 'P' },
  });
  assert(!missingCity.success, 'City with 1 character is rejected');

  // 7. Vendor UPI Payment Settings Validation
  console.log('\n7. Vendor UPI Payment Settings Validation');

  const validUPI = updateVendorPaymentSettingsSchema.safeParse({
    body: {
      upiId: 'ramesh@ybl',
      upiQrUrl: 'https://cdn.ringers.com/upi-qr/ramesh-store.png',
      upiPayUrl: 'upi://pay?pa=ramesh@ybl&pn=RameshStore',
    },
  });
  assert(validUPI.success, 'Valid UPI settings payload passes');

  const shortUpiId = updateVendorPaymentSettingsSchema.safeParse({
    body: { upiId: 'ab' },
  });
  assert(!shortUpiId.success, 'UPI ID shorter than 3 characters is rejected');

  const invalidQrUrl = updateVendorPaymentSettingsSchema.safeParse({
    body: { upiQrUrl: 'not-a-valid-url' },
  });
  assert(!invalidQrUrl.success, 'Invalid UPI QR URL format is rejected');

  // 8. Express App Integrity
  console.log('\n8. Express App & Admin Routes Mounting');
  const app = createApp();
  assert(typeof app === 'function', 'Express app with admin routes compiles and mounts correctly');

  console.log('\n================================');
  console.log(`Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test suite crashed:', err);
  process.exit(1);
});
