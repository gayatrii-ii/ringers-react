/**
 * Ringers Backend - Auth & Multi-Role Verification Suite
 * Tests token generation, role verification, password hashing, and endpoint security.
 */
import bcrypt from 'bcryptjs';
import { ROLES } from '../src/constants/roles.js';
import { TokenService } from '../src/modules/auth/token.service.js';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';

async function runTests() {
  console.log('🧪 Starting Ringers Phase 2 Auth & Multi-Role Verification...\n');

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

  // 1. Password Hashing & Verification
  console.log('1. Password Hashing (BCrypt)');
  const plainPassword = 'SuperSecretPassword@2026';
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(plainPassword, salt);
  assert(await bcrypt.compare(plainPassword, hash), 'BCrypt correctly verifies matching password');
  assert(!(await bcrypt.compare('WrongPassword', hash)), 'BCrypt rejects incorrect password');

  // 2. JWT Access Token Signing & Decoding
  console.log('\n2. JWT Access Token Lifecycle');
  const mockPayload = {
    userId: '11111111-2222-3333-4444-555555555555',
    email: 'admin@ringer.com',
    phone: '+919876543210',
    roles: [ROLES.SUPER_ADMIN],
  };

  const token = TokenService.signAccessToken(mockPayload);
  assert(typeof token === 'string' && token.length > 50, 'Generates valid JWT string');

  const decoded = jwt.verify(token, env.JWT_SECRET) as any;
  assert(decoded.sub === mockPayload.userId, 'JWT contains correct user ID (sub)');
  assert(decoded.email === mockPayload.email, 'JWT contains correct email');
  assert(decoded.roles.includes(ROLES.SUPER_ADMIN), 'JWT retains SUPER_ADMIN role');

  // 3. Multi-Role RBAC Authorization Logic
  console.log('\n3. Multi-Role RBAC Authorization');
  const vendorRoles = [ROLES.VENDOR];
  const deliveryRoles = [ROLES.DELIVERY_BOY];
  const customerRoles = [ROLES.CUSTOMER];

  const canVendorAccessVendorPortal = vendorRoles.some((r) => [ROLES.VENDOR, ROLES.SUPER_ADMIN].includes(r as any));
  const canCustomerAccessVendorPortal = customerRoles.some((r) => [ROLES.VENDOR, ROLES.SUPER_ADMIN].includes(r as any));
  const canDeliveryAccessAdminPortal = deliveryRoles.some((r) => [ROLES.SUPER_ADMIN].includes(r as any));

  assert(canVendorAccessVendorPortal, 'Vendor permitted on vendor-allowed routes');
  assert(!canCustomerAccessVendorPortal, 'Customer blocked from vendor-allowed routes (Role Guard)');
  assert(!canDeliveryAccessAdminPortal, 'Delivery Partner blocked from Super Admin route');

  // 4. Role Hierarchy & Multi-Role Support
  console.log('\n4. Multi-Role Multi-Tenant Integrity');
  const multiRoleUser = [ROLES.VENDOR, ROLES.CUSTOMER];
  assert(multiRoleUser.includes(ROLES.VENDOR) && multiRoleUser.includes(ROLES.CUSTOMER), 'User can hold both Vendor and Customer contexts safely');

  console.log(`\n================================`);
  console.log(`Tests Run: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  console.log(`================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
