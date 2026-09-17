import { Request, Response, NextFunction } from 'express';
import { NotificationService } from './notification.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class NotificationController {
  /**
   * GET /api/v1/notifications
   * Get user's notifications (paginated, filter by isRead / type)
   */
  public static async getUserNotifications(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
      const type = req.query.type ? String(req.query.type) : undefined;
      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(String(req.query.page || '1'), 10);
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || '20'), 10);

      const result = await NotificationService.getUserNotifications(req.user.userId, {
        isRead,
        type,
        page,
        limit,
      });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * Header badge unread counter
   */
  public static async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const result = await NotificationService.getUnreadCount(req.user.userId);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/:id/read
   * Mark a single notification as read
   */
  public static async markAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { id } = req.params;
      const notification = await NotificationService.markAsRead(id as string, req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Notification marked as read',
        data: notification,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Bulk mark all notifications as read
   */
  public static async markAllAsRead(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const result = await NotificationService.markAllAsRead(req.user.userId);

      res.status(200).json({
        success: true,
        message: 'All notifications marked as read',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/device-token
   * Register or update mobile FCM push notification token
   */
  public static async registerDeviceToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { fcmToken, deviceType } = req.body;
      const result = await NotificationService.registerDeviceToken(req.user.userId, fcmToken, deviceType);

      res.status(200).json({
        success: true,
        message: 'Device token registered successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/notifications/admin/broadcast
   * Super Admin broadcast alert to users
   */
  public static async broadcast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { title, message, targetRole } = req.body;
      const result = await NotificationService.broadcastNotification(
        req.user.userId,
        title,
        message,
        targetRole
      );

      res.status(200).json({
        success: true,
        message: `Broadcast delivered to ${result.recipientCount} active accounts`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
