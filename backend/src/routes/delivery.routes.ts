import { Router } from 'express';
import { DeliveryController } from '../modules/delivery/delivery.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  updateDeliveryProfileSchema,
  updateDutyStatusSchema,
  adminUpdateRiderStatusSchema,
} from '../modules/delivery/delivery.validation.js';

const router = Router();

// All delivery routes require valid JWT authentication
router.use(authenticateToken);

// ==========================================
// 1. Delivery Partner (Rider) Routes
// ==========================================
router.get(
  '/profile/me',
  requireRoles(ROLES.DELIVERY_BOY, ROLES.SUPER_ADMIN),
  DeliveryController.getProfile
);

router.put(
  '/profile/me',
  requireRoles(ROLES.DELIVERY_BOY, ROLES.SUPER_ADMIN),
  validate(updateDeliveryProfileSchema),
  DeliveryController.updateProfile
);

router.patch(
  '/duty-status',
  requireRoles(ROLES.DELIVERY_BOY, ROLES.SUPER_ADMIN),
  validate(updateDutyStatusSchema),
  DeliveryController.updateDutyStatus
);

router.get(
  '/stats',
  requireRoles(ROLES.DELIVERY_BOY, ROLES.SUPER_ADMIN),
  DeliveryController.getStats
);

// ==========================================
// 2. Super Admin / Admin Fleet Management Routes
// ==========================================
router.get(
  '/admin/riders',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  DeliveryController.adminListRiders
);

router.patch(
  '/admin/riders/:id/status',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(adminUpdateRiderStatusSchema),
  DeliveryController.adminSetRiderStatus
);

export default router;
