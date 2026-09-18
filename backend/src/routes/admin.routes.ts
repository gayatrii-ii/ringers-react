import { Router } from 'express';
import { AdminController } from '../modules/admin/admin.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  generateKeySchema,
  keyQuerySchema,
  reviewVendorRequestSchema,
  assignDeliveryRequestSchema,
} from '../modules/admin/admin.validation.js';
import { VendorReferralController } from '../modules/vendors/vendor-referral.controller.js';
import {
  listReferralsSchema,
  updateRewardStatusSchema,
} from '../modules/vendors/vendor-referral.validation.js';

const router = Router();

// Protect ALL routes in this file for SUPER_ADMIN only
router.use(authenticateToken, requireRoles(ROLES.SUPER_ADMIN));

// ==========================================
// 1. Private Registration Key Lifecycle
// ==========================================
router.post('/keys/generate', validate(generateKeySchema), AdminController.generateKey);
router.get('/keys', validate(keyQuerySchema), AdminController.listKeys);
router.patch('/keys/:id/revoke', AdminController.revokeKey);

// ==========================================
// 2. Vendor Registration Requests
// ==========================================
router.get('/vendor-requests', AdminController.listVendorRequests);
router.patch(
  '/vendor-requests/:id/review',
  validate(reviewVendorRequestSchema),
  AdminController.reviewVendorRequest
);

// ==========================================
// 3. Delivery Boy Job Applications
// ==========================================
router.get('/delivery-boy-requests', AdminController.listDeliveryJobRequests);
router.patch(
  '/delivery-boy-requests/:id/assign',
  validate(assignDeliveryRequestSchema),
  AdminController.assignDeliveryJobRequest
);

// ==========================================
// 4. Platform Overview Metrics
// ==========================================
router.get('/metrics', AdminController.getPlatformMetrics);

// ==========================================
// 5. Vendor Referral Governance
// ==========================================
router.get(
  '/referrals',
  validate(listReferralsSchema),
  VendorReferralController.adminListReferrals
);

router.patch(
  '/referrals/:id/reward',
  validate(updateRewardStatusSchema),
  VendorReferralController.adminUpdateRewardStatus
);

export default router;
