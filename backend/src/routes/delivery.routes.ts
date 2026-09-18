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
import { DeliveryAssignmentController } from '../modules/delivery/delivery.assignment.controller.js';
import {
  assignmentIdParamSchema,
  orderIdParamSchema,
  rejectAssignmentSchema,
  completeDeliveryOtpSchema,
  reportDeliveryFailureSchema,
  recordLocationSchema,
} from '../modules/delivery/delivery.assignment.validation.js';

const router = Router();

// All delivery routes require valid JWT authentication
router.use(authenticateToken);

// ==========================================
// 1. Delivery Partner (Rider) Profile & Duty Routes
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
// 1b. Delivery Assignment Lifecycle & Handover (Rider Actions)
// ==========================================
router.post(
  '/assignments/:id/accept',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(assignmentIdParamSchema),
  DeliveryAssignmentController.acceptAssignment
);

router.post(
  '/assignments/:id/reject',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(assignmentIdParamSchema),
  validate(rejectAssignmentSchema),
  DeliveryAssignmentController.rejectAssignment
);

router.post(
  '/assignments/:id/pickup',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(assignmentIdParamSchema),
  DeliveryAssignmentController.markPickedUp
);

router.post(
  '/orders/:id/complete-delivery',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(orderIdParamSchema),
  validate(completeDeliveryOtpSchema),
  DeliveryAssignmentController.completeDeliveryWithOtp
);

router.post(
  '/assignments/:id/fail',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(assignmentIdParamSchema),
  validate(reportDeliveryFailureSchema),
  DeliveryAssignmentController.reportDeliveryFailure
);

router.post(
  '/location',
  requireRoles(ROLES.DELIVERY_BOY),
  validate(recordLocationSchema),
  DeliveryAssignmentController.recordLocation
);

// ==========================================
// 1c. Real-Time Order Tracking (Customer / Vendor / Rider / Admin)
// ==========================================
router.get(
  '/track/:id',
  validate(orderIdParamSchema),
  DeliveryAssignmentController.getOrderTracking
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
