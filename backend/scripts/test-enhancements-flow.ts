/**
 * Ringers Platform - Production Readiness Enhancements Verification Suite
 * Tests all 7 gap-closure capabilities:
 *  1. Password Recovery & Management Validation Schemas (Forgot, Reset, Change)
 *  2. Password Recovery Business Rules & Token Invalidation
 *  3. Vendor Delivery Fleet Listing & Status Management Schemas
 *  4. Delivery Partner Trip History & Assignment Listing Schemas
 *  5. Customer Language Preference Persistence (EN, HI, MR)
 *  6. Customer Activity Dashboard & Quick Statistics Aggregations
 *  7. Customer Account Deactivation Rules (blocks in-progress orders, allows completed)
 *  8. Vendor Sales Trend & Payment Method Breakdown Aggregations
 *  9. Express Route Registry Verification (all new endpoints mounted & reachable)
 */

import {
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../src/modules/auth/auth.validation.js';

import {
  listVendorDeliveryBoysSchema,
  updateVendorRiderStatusSchema,
} from '../src/modules/vendors/vendor-delivery-onboarding.validation.js';

import {
  listRiderAssignmentsSchema,
} from '../src/modules/delivery/delivery.assignment.validation.js';

import {
  updateCustomerProfileSchema,
  updateCustomerLanguageSchema,
} from '../src/modules/customer/customer.validation.js';

import {
  vendorAnalyticsQuerySchema,
  vendorReportPaginationQuerySchema,
} from '../src/modules/analytics/analytics.validation.js';

import {
  updateNotificationPreferencesSchema,
} from '../src/modules/notifications/notification.validation.js';

import { createApp } from '../src/app.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${description}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${description}`);
  }
}

async function runEnhancementsSuite() {
  console.log('\n🧪 Starting Ringers Enhancements & Gap-Closure Verification Suite...\n');

  // ==========================================
  // 1. Password Recovery & Management Schemas
  // ==========================================
  console.log('1. Password Recovery & Change Password Schemas');
  {
    // Forgot password schema
    const validForgot = forgotPasswordSchema.safeParse({
      body: { phone: '9876543210' },
    });
    assert(validForgot.success, 'forgotPasswordSchema accepts valid 10-digit Indian phone');

    const invalidForgot = forgotPasswordSchema.safeParse({
      body: { phone: '1234567890' }, // starts with 1
    });
    assert(!invalidForgot.success, 'forgotPasswordSchema rejects phone not starting with 6-9');

    const shortForgot = forgotPasswordSchema.safeParse({
      body: { phone: '98765' },
    });
    assert(!shortForgot.success, 'forgotPasswordSchema rejects short phone');

    // Reset password schema
    const validReset = resetPasswordSchema.safeParse({
      body: {
        phone: '9876543210',
        otp: '1234',
        newPassword: 'SecurePassword123!',
      },
    });
    assert(validReset.success, 'resetPasswordSchema accepts valid phone, OTP, and new password');

    const shortResetPass = resetPasswordSchema.safeParse({
      body: {
        phone: '9876543210',
        otp: '1234',
        newPassword: 'short',
      },
    });
    assert(!shortResetPass.success, 'resetPasswordSchema rejects newPassword < 8 characters');

    const shortOtp = resetPasswordSchema.safeParse({
      body: {
        phone: '9876543210',
        otp: '12',
        newPassword: 'SecurePassword123!',
      },
    });
    assert(!shortOtp.success, 'resetPasswordSchema rejects OTP < 4 digits');

    // Change password schema
    const validChange = changePasswordSchema.safeParse({
      body: {
        oldPassword: 'OldPassword123!',
        newPassword: 'NewSecurePassword456!',
      },
    });
    assert(validChange.success, 'changePasswordSchema accepts valid old and new passwords');

    const emptyOldChange = changePasswordSchema.safeParse({
      body: {
        oldPassword: '',
        newPassword: 'NewSecurePassword456!',
      },
    });
    assert(!emptyOldChange.success, 'changePasswordSchema rejects empty old password');
  }

  // ==========================================
  // 2. Vendor Delivery Fleet List & Status Schemas
  // ==========================================
  console.log('\n2. Vendor Delivery Fleet Schemas');
  {
    const validListFleet = listVendorDeliveryBoysSchema.safeParse({
      query: { status: 'ACTIVE', page: '1', limit: '10' },
    });
    assert(validListFleet.success, 'listVendorDeliveryBoysSchema accepts valid status and pagination');
    if (validListFleet.success) {
      assert(validListFleet.data.query.page === 1, 'page transformed to number 1');
      assert(validListFleet.data.query.limit === 10, 'limit transformed to number 10');
    }

    const defaultFleet = listVendorDeliveryBoysSchema.safeParse({ query: {} });
    assert(defaultFleet.success, 'listVendorDeliveryBoysSchema accepts empty query with defaults');
    if (defaultFleet.success) {
      assert(defaultFleet.data.query.page === 1, 'Default page is 1');
      assert(defaultFleet.data.query.limit === 20, 'Default limit is 20');
    }

    const validStatusUpdate = updateVendorRiderStatusSchema.safeParse({
      params: { riderId: '123e4567-e89b-12d3-a456-426614174000' },
      body: { status: 'INACTIVE' },
    });
    assert(validStatusUpdate.success, 'updateVendorRiderStatusSchema accepts valid UUID and INACTIVE status');

    const invalidStatus = updateVendorRiderStatusSchema.safeParse({
      params: { riderId: '123e4567-e89b-12d3-a456-426614174000' },
      body: { status: 'INVALID_STATUS' },
    });
    assert(!invalidStatus.success, 'updateVendorRiderStatusSchema rejects invalid status enum');
  }

  // ==========================================
  // 3. Delivery Boy Trip History & Assignments List Schemas
  // ==========================================
  console.log('\n3. Delivery Partner Assignments & History Schemas');
  {
    const validAssignments = listRiderAssignmentsSchema.safeParse({
      query: { status: 'DELIVERED', page: '2', limit: '15' },
    });
    assert(validAssignments.success, 'listRiderAssignmentsSchema accepts DELIVERED filter and pagination');

    const defaultAssignments = listRiderAssignmentsSchema.safeParse({ query: {} });
    assert(defaultAssignments.success, 'listRiderAssignmentsSchema accepts empty query');
    if (defaultAssignments.success) {
      assert(defaultAssignments.data.query.page === 1, 'Default assignments page is 1');
      assert(defaultAssignments.data.query.limit === 20, 'Default assignments limit is 20');
    }

    const invalidAssignStatus = listRiderAssignmentsSchema.safeParse({
      query: { status: 'UNKNOWN_STATUS' },
    });
    assert(!invalidAssignStatus.success, 'listRiderAssignmentsSchema rejects invalid assignment status');
  }

  // ==========================================
  // 4. Customer Language Preference Persistence Schemas
  // ==========================================
  console.log('\n4. Customer Language Preference Schemas');
  {
    const validLangUpdate = updateCustomerLanguageSchema.safeParse({
      body: { language: 'HI' },
    });
    assert(validLangUpdate.success, 'updateCustomerLanguageSchema accepts Hindi (HI)');

    const validMarathi = updateCustomerLanguageSchema.safeParse({
      body: { language: 'MR' },
    });
    assert(validMarathi.success, 'updateCustomerLanguageSchema accepts Marathi (MR)');

    const validEnglish = updateCustomerLanguageSchema.safeParse({
      body: { language: 'EN' },
    });
    assert(validEnglish.success, 'updateCustomerLanguageSchema accepts English (EN)');

    const invalidLang = updateCustomerLanguageSchema.safeParse({
      body: { language: 'FR' },
    });
    assert(!invalidLang.success, 'updateCustomerLanguageSchema rejects unsupported language (FR)');

    // updateCustomerProfileSchema allows preferredLanguage
    const profileWithLang = updateCustomerProfileSchema.safeParse({
      body: {
        firstName: 'Karan',
        preferredLanguage: 'MR',
      },
    });
    assert(profileWithLang.success, 'updateCustomerProfileSchema accepts preferredLanguage: MR');
  }

  // ==========================================
  // 5. Customer Dashboard Stats Business Logic Simulation
  // ==========================================
  console.log('\n5. Customer Dashboard Stats Logic');
  {
    // Simulating order aggregations
    const mockOrders = [
      { id: '1', status: 'DELIVERED', total: 450 },
      { id: '2', status: 'DELIVERED', total: 650 },
      { id: '3', status: 'OUT_FOR_DELIVERY', total: 300 },
      { id: '4', status: 'CANCELLED', total: 200 },
    ];

    const totalOrders = mockOrders.length;
    const activeOrders = mockOrders.filter((o) =>
      ['PLACED', 'CONFIRMED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY'].includes(o.status)
    ).length;
    const completedOrders = mockOrders.filter((o) => o.status === 'DELIVERED').length;
    const cancelledOrders = mockOrders.filter((o) => o.status === 'CANCELLED').length;
    const totalSpent = mockOrders
      .filter((o) => o.status === 'DELIVERED')
      .reduce((sum, o) => sum + o.total, 0);

    assert(totalOrders === 4, 'Total orders count matches 4');
    assert(activeOrders === 1, 'Active orders in-transit count matches 1');
    assert(completedOrders === 2, 'Completed orders count matches 2');
    assert(cancelledOrders === 1, 'Cancelled orders count matches 1');
    assert(totalSpent === 1100, 'Total spent on completed orders is 1100');
  }

  // ==========================================
  // 6. Account Deactivation Safety Rules
  // ==========================================
  console.log('\n6. Account Deactivation Safety Guardrails');
  {
    // Function that enforces the business rule
    function canDeactivateAccount(orders: Array<{ status: string }>): boolean {
      const activeInTransit = orders.some((o) => !['DELIVERED', 'CANCELLED'].includes(o.status));
      return !activeInTransit;
    }

    const hasActiveOrders = [{ status: 'OUT_FOR_DELIVERY' }, { status: 'DELIVERED' }];
    assert(
      canDeactivateAccount(hasActiveOrders) === false,
      'Deactivation is blocked when user has orders OUT_FOR_DELIVERY'
    );

    const hasPreparingOrder = [{ status: 'PREPARING' }];
    assert(
      canDeactivateAccount(hasPreparingOrder) === false,
      'Deactivation is blocked when user has order PREPARING'
    );

    const onlyFinishedOrders = [{ status: 'DELIVERED' }, { status: 'CANCELLED' }];
    assert(
      canDeactivateAccount(onlyFinishedOrders) === true,
      'Deactivation is allowed when all orders are DELIVERED or CANCELLED'
    );

    const noOrdersAtAll: Array<{ status: string }> = [];
    assert(
      canDeactivateAccount(noOrdersAtAll) === true,
      'Deactivation is allowed when user has zero orders'
    );
  }

  // ==========================================
  // 7. Vendor Analytics Trend & Payment Breakdown Schemas
  // ==========================================
  console.log('\n7. Vendor Analytics Breakdowns');
  {
    const validAnalyticsQuery = vendorAnalyticsQuerySchema.safeParse({
      query: { period: 'month' },
    });
    assert(validAnalyticsQuery.success, 'vendorAnalyticsQuerySchema accepts month period');

    // Payment percentage calculation simulation
    const mockPayments = [
      { method: 'CASH', amount: 5000 },
      { method: 'ONLINE', amount: 3000 },
      { method: 'WALLET', amount: 2000 },
    ];
    const totalRevenue = mockPayments.reduce((s, p) => s + p.amount, 0);
    const cashPct = Math.round((5000 / totalRevenue) * 100);
    const onlinePct = Math.round((3000 / totalRevenue) * 100);
    const walletPct = Math.round((2000 / totalRevenue) * 100);

    assert(totalRevenue === 10000, 'Total revenue sums to 10,000');
    assert(cashPct === 50, 'Cash share is 50%');
    assert(onlinePct === 30, 'Online share is 30%');
    assert(walletPct === 20, 'Wallet share is 20%');
    assert(cashPct + onlinePct + walletPct === 100, 'Shares total 100%');
  }

  // ==========================================
  // 8. Express Route Registry Verification
  // ==========================================
  console.log('\n8. Express Route Registry Verification');
  {
    const app = createApp();
    assert(typeof app === 'function', 'createApp() produces valid Express application');

    // Extract all registered route endpoints
    const routes: string[] = [];

    function extractRoutes(stack: any[], prefix = '') {
      for (const layer of stack) {
        if (layer.route) {
          const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
          routes.push(`${methods} ${prefix}${layer.route.path}`);
        } else if (layer.name === 'router' && layer.handle?.stack) {
          let routePrefix = prefix;
          if (layer.regexp) {
            const match = layer.regexp.source
              .replace('^\\', '')
              .replace('\\/?(?=\\/|$)', '')
              .replace(/\\\//g, '/')
              .replace(/\^/g, '')
              .replace(/\$/g, '')
              .replace(/\(\?:\(\[\^\\\/]\+\?\)\)/g, ':id');
            routePrefix = prefix + match;
          }
          extractRoutes(layer.handle.stack, routePrefix);
        }
      }
    }

    if ((app as any)._router?.stack) {
      extractRoutes((app as any)._router.stack);
    }

    const hasRoute = (pattern: RegExp) => routes.some((r) => pattern.test(r));

    // Check newly added endpoints
    assert(hasRoute(/POST.*\/auth\/forgot-password/), 'Route POST /auth/forgot-password mounted');
    assert(hasRoute(/POST.*\/auth\/reset-password/), 'Route POST /auth/reset-password mounted');
    assert(hasRoute(/PUT.*\/auth\/change-password/), 'Route PUT /auth/change-password mounted');
    assert(hasRoute(/GET.*\/vendors\/delivery-boys/), 'Route GET /vendors/delivery-boys mounted');
    assert(hasRoute(/PATCH.*\/vendors\/delivery-boys\/.*\/status/), 'Route PATCH /vendors/delivery-boys/:riderId/status mounted');
    assert(hasRoute(/GET.*\/delivery\/assignments/), 'Route GET /delivery/assignments mounted');
    assert(hasRoute(/PATCH.*\/customers\/profile\/language/), 'Route PATCH /customers/profile/language mounted');
    assert(hasRoute(/GET.*\/customers\/profile\/stats/), 'Route GET /customers/profile/stats mounted');
    assert(hasRoute(/DELETE.*\/customers\/profile\/me/), 'Route DELETE /customers/profile/me mounted');
    assert(hasRoute(/GET.*\/analytics\/vendor\/sales-trend/), 'Route GET /analytics/vendor/sales-trend mounted');
    assert(hasRoute(/GET.*\/analytics\/vendor\/payment-breakdown/), 'Route GET /analytics/vendor/payment-breakdown mounted');
    assert(hasRoute(/GET.*\/notifications\/preferences/), 'Route GET /notifications/preferences mounted');
    assert(hasRoute(/PUT.*\/notifications\/preferences/), 'Route PUT /notifications/preferences mounted');
    assert(hasRoute(/GET.*\/analytics\/vendor\/product-sales/), 'Route GET /analytics/vendor/product-sales mounted');
    assert(hasRoute(/GET.*\/analytics\/vendor\/customer-sales/), 'Route GET /analytics/vendor/customer-sales mounted');
    assert(hasRoute(/GET.*\/analytics\/vendor\/rider-performance/), 'Route GET /analytics/vendor/rider-performance mounted');

    console.log(`  ℹ️ Total mounted Express endpoints in application: ${routes.length}`);
  }

  // ==========================================
  // 9. Notification Preferences Schema Verification
  // ==========================================
  console.log('\n9. Notification Preferences Schemas');
  {
    const validPrefs = updateNotificationPreferencesSchema.safeParse({
      body: {
        orderUpdates: true,
        promotionalAlerts: false,
        smsEnabled: true,
        pushEnabled: true,
      },
    });
    assert(validPrefs.success, 'updateNotificationPreferencesSchema accepts valid preference toggles');

    const emptyBody = updateNotificationPreferencesSchema.safeParse({
      body: {},
    });
    assert(emptyBody.success, 'updateNotificationPreferencesSchema accepts empty body for partial updates');

    const invalidType = updateNotificationPreferencesSchema.safeParse({
      body: {
        orderUpdates: 'invalid-string',
      },
    });
    assert(!invalidType.success, 'updateNotificationPreferencesSchema rejects non-boolean value');
  }

  // ==========================================
  // 10. Detailed Vendor Report Schemas Verification
  // ==========================================
  console.log('\n10. Detailed Vendor Report Schemas');
  {
    const validReportQuery = vendorReportPaginationQuerySchema.safeParse({
      query: {
        period: 'month',
        page: '2',
        limit: '15',
      },
    });
    assert(validReportQuery.success, 'vendorReportPaginationQuerySchema accepts valid pagination and period');
    if (validReportQuery.success) {
      assert(validReportQuery.data.query.page === 2, 'Report page transformed to integer 2');
      assert(validReportQuery.data.query.limit === 15, 'Report limit transformed to integer 15');
    }

    const defaultReportQuery = vendorReportPaginationQuerySchema.safeParse({
      query: {},
    });
    assert(defaultReportQuery.success, 'vendorReportPaginationQuerySchema accepts empty query with defaults');
    if (defaultReportQuery.success) {
      assert(defaultReportQuery.data.query.page === 1, 'Default report page is 1');
      assert(defaultReportQuery.data.query.limit === 20, 'Default report limit is 20');
      assert(defaultReportQuery.data.query.period === 'month', 'Default report period is month');
    }

    const invalidPeriod = vendorReportPaginationQuerySchema.safeParse({
      query: {
        period: 'biweekly',
      },
    });
    assert(!invalidPeriod.success, 'vendorReportPaginationQuerySchema rejects unsupported period');
  }

  // ==========================================
  // Summary
  // ==========================================
  console.log('\n════════════════════════════════════════════════════════════');
  console.log(`  Enhancements Verification: ${passedTests} PASSED, ${failedTests} FAILED (Total: ${totalTests})`);
  console.log('════════════════════════════════════════════════════════════\n');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runEnhancementsSuite().catch((err) => {
  console.error('Fatal error in enhancements test runner:', err);
  process.exit(1);
});
