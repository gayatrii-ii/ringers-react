import { Router } from 'express';
import { OrderController } from '../modules/orders/order.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  calculateOrderSchema,
  createOrderSchema,
  updateOrderStatusSchema,
  cancelOrderSchema,
  orderIdParamSchema,
  orderQuerySchema,
} from '../modules/orders/order.validation.js';
import { DeliveryAssignmentController } from '../modules/delivery/delivery.assignment.controller.js';
import { assignDeliverySchema } from '../modules/delivery/delivery.assignment.validation.js';

const router = Router();

// All order endpoints require JWT authentication
router.use(authenticateToken);

// ==========================================
// 1. Customer Cart & Checkout Routes
// ==========================================
router.post(
  '/calculate',
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(calculateOrderSchema),
  OrderController.calculateOrder
);

router.post(
  '/',
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(createOrderSchema),
  OrderController.createOrder
);

router.get(
  '/my-orders',
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(orderQuerySchema),
  OrderController.listCustomerOrders
);

// ==========================================
// 2. Vendor Live Order Desk Routes
// ==========================================
router.get(
  '/vendor/live',
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(orderQuerySchema),
  OrderController.listVendorOrders
);

// ==========================================
// 3. Super Admin Platform Monitor Routes
// ==========================================
router.get(
  '/admin/all',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(orderQuerySchema),
  OrderController.listAdminOrders
);

// ==========================================
// 4. Single Order Operations (Scoped Access)
// ==========================================
router.get(
  '/:id',
  validate(orderIdParamSchema),
  OrderController.getOrder
);

router.patch(
  '/:id/status',
  requireRoles(ROLES.VENDOR, ROLES.DELIVERY_BOY, ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(updateOrderStatusSchema),
  OrderController.updateOrderStatus
);

router.patch(
  '/:id/cancel',
  validate(cancelOrderSchema),
  OrderController.cancelOrder
);

// ==========================================
// 5. Delivery Assignment & Handover Extensions
// ==========================================
// Vendor-Only delivery assignment authority
router.post(
  '/:id/assign-delivery',
  requireRoles(ROLES.VENDOR),
  validate(orderIdParamSchema),
  validate(assignDeliverySchema),
  DeliveryAssignmentController.assignRider
);

// Customer Direct Delivery Confirmation (Path B)
router.post(
  '/:id/confirm-delivery',
  requireRoles(ROLES.CUSTOMER),
  validate(orderIdParamSchema),
  DeliveryAssignmentController.customerConfirmDelivery
);

export default router;
