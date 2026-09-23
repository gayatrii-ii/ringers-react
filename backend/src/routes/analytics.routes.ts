import { Router } from 'express';
import { AnalyticsController } from '../modules/analytics/analytics.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  adminAnalyticsQuerySchema,
  vendorAnalyticsQuerySchema,
  vendorReportPaginationQuerySchema,
  leaderboardQuerySchema,
  vendorOverviewParamsSchema,
  adminSalesReportQuerySchema,
  adminOrdersReportQuerySchema,
} from '../modules/analytics/analytics.validation.js';

const router = Router();

// All analytics routes require authentication
router.use(authenticateToken);

// 1. Super Admin: Platform Overview
router.get(
  '/admin/overview',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(adminAnalyticsQuerySchema),
  AnalyticsController.getAdminOverview
);

// 2. Super Admin: Top Vendors Leaderboard
router.get(
  '/admin/vendors-leaderboard',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(leaderboardQuerySchema),
  AnalyticsController.getVendorLeaderboard
);

// 3. Super Admin: Delivery Fleet Performance
router.get(
  '/admin/delivery-performance',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(adminAnalyticsQuerySchema),
  AnalyticsController.getDeliveryPerformance
);

// 3a. Super Admin: Vendor 360° Overview
router.get(
  '/admin/vendors/:vendorId/overview',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(vendorOverviewParamsSchema),
  AnalyticsController.getVendor360Overview
);

// 3b. Super Admin: Vendor Sales Report
router.get(
  '/admin/vendor-sales-report',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(adminSalesReportQuerySchema),
  AnalyticsController.getAdminSalesReport
);

// 3c. Super Admin: Platform Orders Report
router.get(
  '/admin/platform-orders-report',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(adminOrdersReportQuerySchema),
  AnalyticsController.getAdminOrdersReport
);


// 4. Vendor: Store Performance & Revenue
router.get(
  '/vendor/overview',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorAnalyticsQuerySchema),
  AnalyticsController.getVendorOverview
);

// 5. Vendor: Sales Revenue Trend (Daily / Weekly Time Series)
router.get(
  '/vendor/sales-trend',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorAnalyticsQuerySchema),
  AnalyticsController.getVendorSalesTrend
);

// 6. Vendor: Payment Method Breakdown
router.get(
  '/vendor/payment-breakdown',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorAnalyticsQuerySchema),
  AnalyticsController.getVendorPaymentBreakdown
);

// 7. Vendor: Detailed Product-wise Sales Report
router.get(
  '/vendor/product-sales',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorReportPaginationQuerySchema),
  AnalyticsController.getVendorProductSales
);

// 8. Vendor: Detailed Customer-wise Sales Report
router.get(
  '/vendor/customer-sales',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorReportPaginationQuerySchema),
  AnalyticsController.getVendorCustomerSales
);

// 9. Vendor: Detailed Rider-wise Delivery Performance Report
router.get(
  '/vendor/rider-performance',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorReportPaginationQuerySchema),
  AnalyticsController.getVendorRiderPerformance
);

export default router;
