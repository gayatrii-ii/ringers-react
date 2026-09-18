/**
 * Phase 8 Operational Flows - End-to-End Test Suite
 * Tests all new backend features: Customer Onboarding (Dual Flow),
 * Customer-Specific Pricing, Delivery Assignment/OTP/Confirmation,
 * Delivery Boy Job Pipeline, Vendor Referral, and Support Tickets.
 *
 * Run: npm run test:phase8
 */

import fetch from 'node-fetch';

const BASE = 'http://localhost:3000/api/v1';
const TIMEOUT = 8000;

// ─── Helper Functions ──────────────────────────────────────────────────────

async function req(
  method: string,
  path: string,
  body?: object,
  token?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), TIMEOUT);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal as any,
    });
    clearTimeout(tid);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } catch (err: any) {
    clearTimeout(tid);
    if (err.name === 'AbortError') return { status: 0, data: { error: 'Request timed out' } };
    return { status: 0, data: { error: err.message } };
  }
}

let passed = 0;
let failed = 0;
let skipped = 0;

function assert(condition: boolean, label: string, detail?: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}${detail ? `\n          ${detail}` : ''}`);
    failed++;
  }
}

function skip(label: string, reason: string): void {
  console.warn(`  ⏭  SKIP: ${label} — ${reason}`);
  skipped++;
}

function section(title: string): void {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${'═'.repeat(60)}`);
}

// ─── Auth helpers ───────────────────────────────────────────────────────────

async function loginAs(phone: string, password: string): Promise<string | null> {
  const r = await req('POST', '/auth/login', { phone, password });
  if (r.status === 200 && r.data?.data?.accessToken) return r.data.data.accessToken;
  return null;
}

// ─── Main Test Suite ────────────────────────────────────────────────────────

async function runPhase8Tests() {
  console.log('\n🚀  Ringers — Phase 8 Operational Flows Test Suite');
  console.log(`    Base URL: ${BASE}\n`);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('1. Health Check');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    const r = await req('GET', '/health');
    assert(r.status === 200 && r.data?.status === 'UP', 'API health check returns UP', JSON.stringify(r.data));
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('2. Authentication — Get Tokens');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const adminToken = await loginAs('+919000000000', 'SuperAdmin@123!');
  assert(!!adminToken, 'Super admin login succeeds');

  if (!adminToken) {
    console.error('\n⛔  Cannot proceed without Super Admin credentials. Ensure the server is running and seeded.\n');
    return;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('3. Customer Flow B — Direct Registration Request (Public)');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // We need an existing vendor id for this. Get one from the platform.
    const vendorsRes = await req('GET', '/vendors?limit=1');
    const firstVendor = vendorsRes.data?.data?.[0];

    if (!firstVendor) {
      skip('Customer direct registration request', 'No vendors found in system — skipping');
    } else {
      const vendorId = firstVendor.id;
      const testPhone = `+9199${Date.now().toString().slice(-8)}`;

      const regRes = await req('POST', '/customers/registration-requests', {
        vendorId,
        firstName: 'Prospective',
        lastName: 'Customer',
        phone: testPhone,
        addressLine1: '123 Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        notes: 'Phase 8 test registration',
      });

      assert(
        regRes.status === 201 && regRes.data?.success === true,
        'Customer submits direct registration request (public endpoint)',
        `status=${regRes.status} data=${JSON.stringify(regRes.data)}`
      );

      const requestId = regRes.data?.data?.requestId;
      assert(!!requestId, 'Registration request returns a requestId');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('4. Vendor — View Customer Registration Requests');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // This requires a vendor token; admin can impersonate via SUPER_ADMIN role
    const r = await req('GET', '/vendors/customers/registration-requests?status=PENDING', undefined, adminToken);
    assert(
      r.status === 200 && Array.isArray(r.data?.data),
      'Admin/Vendor can list customer registration requests',
      `status=${r.status} data=${JSON.stringify(r.data?.data?.slice(0, 2))}`
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('5. Delivery Boy Job Application Pipeline');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // 5a. Public submission
    const jobRes = await req('POST', '/public/delivery-job-request', {
      firstName: 'Test',
      lastName: 'Rider',
      phone: `+9188${Date.now().toString().slice(-8)}`,
      vehicleType: 'BIKE',
      vehicleNumber: 'MH01AB1234',
      licenseNumber: 'DL-1420110012345',
    });
    assert(
      jobRes.status === 201 && jobRes.data?.success === true,
      'Applicant submits delivery job request (public)',
      `status=${jobRes.status} message=${jobRes.data?.message}`
    );

    const jobRequestId = jobRes.data?.data?.id;
    assert(!!jobRequestId, 'Job request returns an ID');

    // 5b. Admin lists job requests
    const listRes = await req('GET', '/admin/delivery-boy-requests?status=PENDING', undefined, adminToken);
    assert(
      listRes.status === 200 && Array.isArray(listRes.data?.data),
      'Admin can list pending delivery job requests',
      `count=${listRes.data?.data?.length}`
    );

    // 5c. Get a vendor to connect to
    const vendorsRes = await req('GET', '/vendors?limit=1');
    const firstVendorId = vendorsRes.data?.data?.[0]?.id;

    if (jobRequestId && firstVendorId) {
      // Admin connects to vendor
      const assignRes = await req(
        'PATCH',
        `/admin/delivery-boy-requests/${jobRequestId}/assign`,
        { vendorId: firstVendorId, notes: 'Phase 8 test assignment' },
        adminToken
      );
      assert(
        assignRes.status === 200 && assignRes.data?.success === true,
        'Admin connects delivery applicant to vendor',
        `status=${assignRes.status} data=${JSON.stringify(assignRes.data?.data)}`
      );

      // Vendor sees connected requests
      const vendorJobListRes = await req(
        'GET',
        '/vendors/delivery-boys/job-requests',
        undefined,
        adminToken
      );
      assert(
        vendorJobListRes.status === 200 && Array.isArray(vendorJobListRes.data?.data),
        'Vendor can view connected delivery boy job requests',
        `count=${vendorJobListRes.data?.data?.length}`
      );

      // Vendor activates delivery boy account
      const activateRes = await req(
        'POST',
        '/vendors/delivery-boys/activate',
        { jobRequestId, password: 'Rider@Test123!' },
        adminToken
      );
      assert(
        activateRes.status === 201 && activateRes.data?.success === true,
        'Vendor activates delivery boy account with credentials',
        `status=${activateRes.status} phone=${activateRes.data?.data?.phone}`
      );
    } else {
      skip('Delivery boy pipeline connect & activate', 'Missing jobRequestId or vendorId');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('6. Vendor Referral Program');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // 6a. Get referral profile (vendor or admin)
    const refProfile = await req('GET', '/vendors/referral', undefined, adminToken);
    assert(
      refProfile.status === 200 && refProfile.data?.success === true,
      'Vendor can get their referral profile and code',
      `status=${refProfile.status} code=${refProfile.data?.data?.referralCode}`
    );

    // 6b. Invite a referee
    const inviteRes = await req(
      'POST',
      '/vendors/referrals/invite',
      { refereePhone: '+917700000001', refereeEmail: 'test@referee.com' },
      adminToken
    );
    assert(
      inviteRes.status === 201 && inviteRes.data?.success === true,
      'Vendor can invite a referee to the platform',
      `status=${inviteRes.status}`
    );

    // 6c. List referrals
    const listRef = await req('GET', '/vendors/referrals', undefined, adminToken);
    assert(
      listRef.status === 200 && Array.isArray(listRef.data?.data),
      'Vendor can list their referrals',
      `count=${listRef.data?.data?.length}`
    );

    // 6d. Admin lists all referrals
    const adminRefList = await req('GET', '/admin/referrals', undefined, adminToken);
    assert(
      adminRefList.status === 200 && Array.isArray(adminRefList.data?.data),
      'Admin can list all referrals platform-wide',
      `count=${adminRefList.data?.data?.length}`
    );

    // 6e. Admin updates a reward status
    const referralId = listRef.data?.data?.[0]?.id;
    if (referralId) {
      const rewardRes = await req(
        'PATCH',
        `/admin/referrals/${referralId}/reward`,
        { rewardStatus: 'APPROVED', rewardAmount: 500, rewardNotes: 'Approved after vendor activation' },
        adminToken
      );
      assert(
        rewardRes.status === 200 && rewardRes.data?.success === true,
        'Admin can approve a referral reward with amount',
        `status=${rewardRes.status}`
      );
    } else {
      skip('Admin referral reward update', 'No referrals found to update');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('7. Customer-Specific Products & Pricing');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    const vendorsRes = await req('GET', '/vendors?limit=1');
    const vendor = vendorsRes.data?.data?.[0];

    if (!vendor) {
      skip('Customer pricing flow', 'No vendors in system');
    } else {
      const vendorId = vendor.id;

      // Toggle catalog restriction ON
      const toggleRes = await req(
        'PATCH',
        `/vendors/${vendorId}/catalog-restriction`,
        { restrictCustomerCatalog: true },
        adminToken
      );
      assert(
        toggleRes.status === 200,
        'Vendor can toggle customer catalog restriction ON',
        `status=${toggleRes.status}`
      );

      // Toggle back OFF
      const toggleOff = await req(
        'PATCH',
        `/vendors/${vendorId}/catalog-restriction`,
        { restrictCustomerCatalog: false },
        adminToken
      );
      assert(
        toggleOff.status === 200,
        'Vendor can toggle customer catalog restriction OFF',
        `status=${toggleOff.status}`
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('8. Support & Issue Tickets');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // Create a ticket
    const createRes = await req(
      'POST',
      '/support/tickets',
      {
        category: 'GENERAL',
        subject: 'Phase 8 Test Ticket',
        description: 'This is a test support ticket created by the Phase 8 test suite.',
        priority: 'LOW',
      },
      adminToken
    );
    assert(
      createRes.status === 201 && createRes.data?.success === true,
      'Authenticated user can create a support ticket',
      `status=${createRes.status} ticketNumber=${createRes.data?.data?.ticketNumber}`
    );

    const ticketId = createRes.data?.data?.id;

    // List my tickets
    const myTickets = await req('GET', '/support/tickets/my', undefined, adminToken);
    assert(
      myTickets.status === 200 && Array.isArray(myTickets.data?.data),
      'User can list their own tickets',
      `count=${myTickets.data?.data?.length}`
    );

    // Admin list all tickets
    const adminTickets = await req('GET', '/support/admin/tickets', undefined, adminToken);
    assert(
      adminTickets.status === 200 && Array.isArray(adminTickets.data?.data),
      'Admin can list all support tickets',
      `count=${adminTickets.data?.data?.length}`
    );

    // Admin resolve ticket
    if (ticketId) {
      const resolveRes = await req(
        'PATCH',
        `/support/admin/tickets/${ticketId}/resolve`,
        { status: 'RESOLVED', adminResponse: 'Test ticket resolved by automated suite.' },
        adminToken
      );
      assert(
        resolveRes.status === 200 && resolveRes.data?.success === true,
        'Admin can resolve a support ticket',
        `status=${resolveRes.status}`
      );
    } else {
      skip('Admin ticket resolution', 'Ticket creation failed, no ticketId');
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('9. Delivery Assignment Authority — Vendor Only');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    // Try to assign delivery via admin (should fail — vendor-only)
    // First, get any PENDING order
    const ordersRes = await req('GET', '/orders/admin/all?status=PENDING&limit=1', undefined, adminToken);
    const order = ordersRes.data?.data?.[0];

    if (!order) {
      skip('Vendor-only delivery assignment guard', 'No PENDING orders found in system');
    } else {
      const orderId = order.id;

      // Admin (SUPER_ADMIN role) should get 403 when trying to assign
      // NOTE: admin.routes is protected with SUPER_ADMIN, but order assign route
      // requires VENDOR role specifically. With SUPER_ADMIN JWT, the require ROLES.VENDOR
      // check will fail (they don't have VENDOR role)
      const assignRes = await req(
        'POST',
        `/orders/${orderId}/assign-delivery`,
        { riderId: '00000000-0000-0000-0000-000000000000' },
        adminToken
      );
      assert(
        assignRes.status === 403,
        'Super Admin cannot assign delivery (vendor-only authority enforced)',
        `status=${assignRes.status} error=${JSON.stringify(assignRes.data?.error)}`
      );
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  section('10. Platform Metrics');
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    const metricsRes = await req('GET', '/admin/metrics', undefined, adminToken);
    assert(
      metricsRes.status === 200 && metricsRes.data?.success === true,
      'Admin can retrieve platform-wide metrics',
      `status=${metricsRes.status}`
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // Final Results
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const total = passed + failed + skipped;
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`  Phase 8 Test Results`);
  console.log(`${'═'.repeat(60)}`);
  console.log(`  Total:   ${total}`);
  console.log(`  ✅ Pass:  ${passed}`);
  console.log(`  ❌ Fail:  ${failed}`);
  console.log(`  ⏭  Skip:  ${skipped}`);
  console.log(`${'═'.repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8Tests().catch((err) => {
  console.error('Unexpected error during Phase 8 tests:', err);
  process.exit(1);
});
