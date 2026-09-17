/**
 * Ringers Platform - Phase 4 Verification Suite
 * Tests: Customer profile & address book (GPS lat/long, Indian PIN, default toggle)
 *        Delivery partner vehicle profiles, fleet status transitions, and route mounts.
 */

import {
  updateCustomerProfileSchema,
  createCustomerAddressSchema,
  updateCustomerAddressSchema,
  addressIdParamSchema,
} from '../src/modules/customer/customer.validation.js';

import {
  updateDeliveryProfileSchema,
  updateDutyStatusSchema,
  adminUpdateRiderStatusSchema,
} from '../src/modules/delivery/delivery.validation.js';

import { createApp } from '../src/app.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 4 Customer & Delivery Verification...\n');

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
  // 1. Customer Profile Validation
  // =========================================================================
  console.log('1. Customer Profile Validation');

  const validProfile = updateCustomerProfileSchema.safeParse({
    body: {
      firstName: 'Rahul',
      lastName: 'Verma',
      dateOfBirth: '1995-08-15',
      gender: 'MALE',
      profileImage: 'https://cdn.ringers.com/avatars/rahul.png',
    },
  });
  assert(validProfile.success, 'Valid customer profile update payload passes');

  const futureDob = updateCustomerProfileSchema.safeParse({
    body: {
      dateOfBirth: '2099-01-01',
    },
  });
  assert(!futureDob.success, 'Future date of birth is rejected');

  const invalidDobFormat = updateCustomerProfileSchema.safeParse({
    body: {
      dateOfBirth: '15-08-1995', // not YYYY-MM-DD
    },
  });
  assert(!invalidDobFormat.success, 'Non-ISO date of birth format is rejected');

  const invalidGender = updateCustomerProfileSchema.safeParse({
    body: {
      gender: 'UNKNOWN_GENDER',
    },
  });
  assert(!invalidGender.success, 'Invalid gender enum is rejected');

  const emptyProfile = updateCustomerProfileSchema.safeParse({
    body: {},
  });
  assert(!emptyProfile.success, 'Empty profile update body is rejected');

  // =========================================================================
  // 2. Customer Delivery Address Validation
  // =========================================================================
  console.log('\n2. Customer Delivery Address Validation');

  const validAddress = createCustomerAddressSchema.safeParse({
    body: {
      addressType: 'HOME',
      addressLine1: 'Flat 402, Greenfield Apartments',
      addressLine2: 'Near City Mall, Baner',
      city: 'Pune',
      state: 'Maharashtra',
      country: 'India',
      postalCode: '411045',
      latitude: 18.5596581,
      longitude: 73.7799374,
      isDefault: true,
    },
  });
  assert(validAddress.success, 'Valid delivery address with GPS coordinates and 6-digit PIN passes');

  const invalidPinCode = createCustomerAddressSchema.safeParse({
    body: {
      addressType: 'HOME',
      addressLine1: 'Flat 402',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '4110', // invalid 4-digit PIN
    },
  });
  assert(!invalidPinCode.success, 'Invalid 4-digit PIN code is rejected');

  const startingZeroPin = createCustomerAddressSchema.safeParse({
    body: {
      addressType: 'HOME',
      addressLine1: 'Flat 402',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '011045', // Indian PIN codes never start with 0
    },
  });
  assert(!startingZeroPin.success, 'PIN code starting with 0 is rejected');

  const invalidLatitude = createCustomerAddressSchema.safeParse({
    body: {
      addressType: 'WORK',
      addressLine1: 'Tech Park Tower B',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411057',
      latitude: 95.5, // > 90
      longitude: 73.7,
    },
  });
  assert(!invalidLatitude.success, 'Latitude > 90 degrees is rejected');

  const invalidLongitude = createCustomerAddressSchema.safeParse({
    body: {
      addressType: 'WORK',
      addressLine1: 'Tech Park Tower B',
      city: 'Pune',
      state: 'Maharashtra',
      postalCode: '411057',
      latitude: 18.5,
      longitude: -185.2, // < -180
    },
  });
  assert(!invalidLongitude.success, 'Longitude < -180 degrees is rejected');

  const validAddressUpdate = updateCustomerAddressSchema.safeParse({
    body: {
      addressType: 'OTHER',
      addressLine1: 'Office Desk 12, Floor 3',
      isDefault: true,
    },
  });
  assert(validAddressUpdate.success, 'Partial address update with isDefault flag passes');

  const validUuidParam = addressIdParamSchema.safeParse({
    params: { id: '33333333-3333-3333-3333-333333333301' },
  });
  assert(validUuidParam.success, 'Valid address UUID route parameter passes');

  const invalidUuidParam = addressIdParamSchema.safeParse({
    params: { id: 'invalid-address-id' },
  });
  assert(!invalidUuidParam.success, 'Invalid non-UUID address ID is rejected');

  // =========================================================================
  // 3. Delivery Partner Profile & Fleet Management Validation
  // =========================================================================
  console.log('\n3. Delivery Partner Vehicle Profile & Status Validation');

  const validRiderProfile = updateDeliveryProfileSchema.safeParse({
    body: {
      vehicleType: 'BIKE',
      vehicleNumber: 'MH 12 AB 1234',
      licenseNumber: 'MH12-2023-9876543',
    },
  });
  assert(validRiderProfile.success, 'Valid delivery partner vehicle registration passes');

  const invalidVehicleType = updateDeliveryProfileSchema.safeParse({
    body: {
      vehicleType: 'AIRPLANE',
    },
  });
  assert(!invalidVehicleType.success, 'Unsupported vehicle type is rejected');

  const validOnlineStatus = updateDutyStatusSchema.safeParse({
    body: { status: 'ONLINE' },
  });
  assert(validOnlineStatus.success, 'Rider switching status to ONLINE passes');

  const validOfflineStatus = updateDutyStatusSchema.safeParse({
    body: { status: 'OFFLINE' },
  });
  assert(validOfflineStatus.success, 'Rider switching status to OFFLINE passes');

  const validBusyStatus = updateDutyStatusSchema.safeParse({
    body: { status: 'BUSY' },
  });
  assert(validBusyStatus.success, 'Rider switching status to BUSY passes');

  const invalidDutyStatus = updateDutyStatusSchema.safeParse({
    body: { status: 'SLEEPING' },
  });
  assert(!invalidDutyStatus.success, 'Arbitrary status value is rejected');

  const validAdminStatusUpdate = adminUpdateRiderStatusSchema.safeParse({
    params: { id: '44444444-4444-4444-4444-444444444401' },
    body: { status: 'SUSPENDED', notes: 'Repeated non-delivery complaints' },
  });
  assert(validAdminStatusUpdate.success, 'Admin suspension of rider with audit notes passes');

  // =========================================================================
  // 4. Express App & Route Integration Check
  // =========================================================================
  console.log('\n4. Express App & Route Integration Check');

  const app = createApp();
  assert(typeof app === 'function', 'Express application factory compiles and returns app');

  // Inspect registered routes on the router stack
  const routesStack = (app._router && app._router.stack) || [];
  assert(routesStack.length > 0, 'Express application router has route layers loaded');

  console.log('\n================================');
  console.log(`Phase 4 Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log('================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Phase 4 test crashed:', err);
  process.exit(1);
});
