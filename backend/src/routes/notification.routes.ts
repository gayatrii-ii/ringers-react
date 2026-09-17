import { Router } from 'express';
import { NotificationController } from '../modules/notifications/notification.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  notificationQuerySchema,
  notificationIdParamSchema,
  registerDeviceTokenSchema,
  adminBroadcastSchema,
} from '../modules/notifications/notification.validation.js';

const router = Router();

// All notification routes require authentication
router.use(authenticateToken);

// 1. Get user notifications
router.get('/', validate(notificationQuerySchema), NotificationController.getUserNotifications);

// 2. Unread notification badge count
router.get('/unread-count', NotificationController.getUnreadCount);

// 3. Mark all as read
router.patch('/read-all', NotificationController.markAllAsRead);

// 4. Mark single notification as read
router.patch('/:id/read', validate(notificationIdParamSchema), NotificationController.markAsRead);

// 5. Register / update FCM push notification token
router.post('/device-token', validate(registerDeviceTokenSchema), NotificationController.registerDeviceToken);

// 6. Super Admin Broadcast
router.post(
  '/admin/broadcast',
  requireRoles(ROLES.SUPER_ADMIN),
  validate(adminBroadcastSchema),
  NotificationController.broadcast
);

export default router;
