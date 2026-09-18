import { query } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import {
  formatNotification,
  NotificationEvent,
  SupportedLanguage,
  TemplateParams,
} from './notification.i18n.js';

export interface NotificationResponse {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
}

export class NotificationService {
  private static mapNotification(row: any): NotificationResponse {
    return {
      id: row.id,
      userId: row.user_id,
      type: row.type,
      title: row.title,
      message: row.message,
      referenceType: row.reference_type ?? null,
      referenceId: row.reference_id ?? null,
      isRead: row.is_read,
      createdAt: row.created_at,
      readAt: row.read_at ?? null,
    };
  }

  /**
   * 1. Create a single in-app notification directly
   */
  public static async createNotification(data: {
    userId: string;
    type: string;
    title: string;
    message: string;
    referenceType?: string | null;
    referenceId?: string | null;
  }): Promise<NotificationResponse> {
    const res = await query(
      `INSERT INTO notification.notifications (
         user_id, type, title, message, reference_type, reference_id, is_read, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, FALSE, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        data.userId,
        data.type,
        data.title,
        data.message,
        data.referenceType || null,
        data.referenceId || null,
      ]
    );

    return NotificationService.mapNotification(res.rows[0]!);
  }

  /**
   * 2. Send localized notification using the 3-language i18n engine (EN, HI, MR)
   */
  public static async sendLocalizedNotification(data: {
    userId: string;
    event: NotificationEvent;
    lang?: SupportedLanguage;
    params?: TemplateParams;
    referenceType?: string | null;
    referenceId?: string | null;
  }): Promise<NotificationResponse> {
    const { title, message } = formatNotification(data.event, data.lang || 'EN', data.params || {});

    return await NotificationService.createNotification({
      userId: data.userId,
      type: data.event,
      title,
      message,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
    });
  }

  /**
   * 3. Fetch user notifications with pagination & filters
   */
  public static async getUserNotifications(
    userId: string,
    filter: { isRead?: boolean; type?: string; page: number; limit: number }
  ): Promise<{
    notifications: NotificationResponse[];
    total: number;
    unreadCount: number;
    page: number;
    limit: number;
  }> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let pIdx = 2;

    if (filter.isRead !== undefined) {
      conditions.push(`is_read = $${pIdx++}`);
      params.push(filter.isRead);
    }

    if (filter.type) {
      conditions.push(`type = $${pIdx++}`);
      params.push(filter.type);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total count for current filter
    const countRes = await query(
      `SELECT COUNT(*) AS total FROM notification.notifications ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Unread count specifically
    const unreadRes = await query(
      `SELECT COUNT(*) AS unread FROM notification.notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    const unreadCount = parseInt(unreadRes.rows[0]?.unread || '0', 10);

    // Fetch paginated rows
    params.push(filter.limit);
    params.push((filter.page - 1) * filter.limit);

    const listRes = await query(
      `SELECT * FROM notification.notifications
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    return {
      notifications: listRes.rows.map(NotificationService.mapNotification),
      total,
      unreadCount,
      page: filter.page,
      limit: filter.limit,
    };
  }

  /**
   * 4. Quick unread badge counter for mobile & web header
   */
  public static async getUnreadCount(userId: string): Promise<{ unreadCount: number }> {
    const res = await query(
      `SELECT COUNT(*) AS unread FROM notification.notifications WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return { unreadCount: parseInt(res.rows[0]?.unread || '0', 10) };
  }

  /**
   * 5. Mark single notification as read
   */
  public static async markAsRead(notificationId: string, userId: string): Promise<NotificationResponse> {
    const res = await query(
      `UPDATE notification.notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [notificationId, userId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('Notification not found or unauthorized', 404, 'NOTIFICATION_NOT_FOUND');
    }

    return NotificationService.mapNotification(res.rows[0]);
  }

  /**
   * 6. Mark all notifications as read
   */
  public static async markAllAsRead(userId: string): Promise<{ updatedCount: number }> {
    const res = await query(
      `UPDATE notification.notifications
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    return { updatedCount: res.rowCount || 0 };
  }

  /**
   * 7. Register or update FCM Device Token for Push Notifications
   */
  public static async registerDeviceToken(
    userId: string,
    fcmToken: string,
    deviceType: string = 'ANDROID'
  ): Promise<{ registered: boolean; fcmToken: string; deviceType: string }> {
    await query(
      `INSERT INTO notification.user_device_tokens (user_id, fcm_token, device_type, is_active, updated_at)
       VALUES ($1, $2, $3, TRUE, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, fcm_token) 
       DO UPDATE SET is_active = TRUE, updated_at = CURRENT_TIMESTAMP, device_type = $3`,
      [userId, fcmToken, deviceType]
    );

    return { registered: true, fcmToken, deviceType };
  }

  /**
   * 8. Admin Broadcast notification to target user group
   */
  public static async broadcastNotification(
    _adminUserId: string,
    title: string,
    message: string,
    targetRole: string = 'ALL'
  ): Promise<{ recipientCount: number }> {
    let queryStr = `SELECT DISTINCT u.id FROM identity.users u`;
    const params: unknown[] = [];

    if (targetRole !== 'ALL') {
      queryStr += ` JOIN identity.user_roles ur ON ur.user_id = u.id
                    JOIN identity.roles r ON r.id = ur.role_id
                    WHERE r.code = $1 AND u.status = 'ACTIVE'`;
      params.push(targetRole);
    } else {
      queryStr += ` WHERE u.status = 'ACTIVE'`;
    }

    const usersRes = await query(queryStr, params);
    const users = usersRes.rows;

    if (users.length === 0) {
      return { recipientCount: 0 };
    }

    // Insert notification records in batch
    for (const u of users) {
      await query(
        `INSERT INTO notification.notifications (
           user_id, type, title, message, reference_type, is_read, created_at
         ) VALUES ($1, 'ADMIN_BROADCAST', $2, $3, 'SYSTEM', FALSE, CURRENT_TIMESTAMP)`,
        [u.id, title, message]
      );
    }

    return { recipientCount: users.length };
  }

  /**
   * 9. Get user notification preferences
   */
  public static async getUserPreferences(userId: string): Promise<{
    userId: string;
    orderUpdates: boolean;
    promotionalAlerts: boolean;
    deliveryStatus: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
  }> {
    const res = await query<{
      user_id: string;
      order_updates: boolean;
      promotional_alerts: boolean;
      delivery_status: boolean;
      sms_enabled: boolean;
      push_enabled: boolean;
      email_enabled: boolean;
    }>(
      `SELECT user_id, order_updates, promotional_alerts, delivery_status, sms_enabled, push_enabled, email_enabled
       FROM notification.user_preferences
       WHERE user_id = $1`,
      [userId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      // Lazy initialize default preferences
      const initRes = await query<{
        user_id: string;
        order_updates: boolean;
        promotional_alerts: boolean;
        delivery_status: boolean;
        sms_enabled: boolean;
        push_enabled: boolean;
        email_enabled: boolean;
      }>(
        `INSERT INTO notification.user_preferences (user_id)
         VALUES ($1)
         ON CONFLICT (user_id) DO NOTHING
         RETURNING user_id, order_updates, promotional_alerts, delivery_status, sms_enabled, push_enabled, email_enabled`,
        [userId]
      );

      const row = initRes.rows[0] || {
        user_id: userId,
        order_updates: true,
        promotional_alerts: true,
        delivery_status: true,
        sms_enabled: true,
        push_enabled: true,
        email_enabled: false,
      };

      return {
        userId: row.user_id,
        orderUpdates: row.order_updates,
        promotionalAlerts: row.promotional_alerts,
        deliveryStatus: row.delivery_status,
        smsEnabled: row.sms_enabled,
        pushEnabled: row.push_enabled,
        emailEnabled: row.email_enabled,
      };
    }

    const row = res.rows[0];
    return {
      userId: row.user_id,
      orderUpdates: row.order_updates,
      promotionalAlerts: row.promotional_alerts,
      deliveryStatus: row.delivery_status,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
    };
  }

  /**
   * 10. Update user notification preferences
   */
  public static async updateUserPreferences(
    userId: string,
    prefs: {
      orderUpdates?: boolean;
      promotionalAlerts?: boolean;
      deliveryStatus?: boolean;
      smsEnabled?: boolean;
      pushEnabled?: boolean;
      emailEnabled?: boolean;
    }
  ): Promise<{
    userId: string;
    orderUpdates: boolean;
    promotionalAlerts: boolean;
    deliveryStatus: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
    emailEnabled: boolean;
  }> {
    // Ensure row exists
    await this.getUserPreferences(userId);

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [userId];
    let pIdx = 2;

    if (prefs.orderUpdates !== undefined) {
      updates.push(`order_updates = $${pIdx++}`);
      params.push(prefs.orderUpdates);
    }
    if (prefs.promotionalAlerts !== undefined) {
      updates.push(`promotional_alerts = $${pIdx++}`);
      params.push(prefs.promotionalAlerts);
    }
    if (prefs.deliveryStatus !== undefined) {
      updates.push(`delivery_status = $${pIdx++}`);
      params.push(prefs.deliveryStatus);
    }
    if (prefs.smsEnabled !== undefined) {
      updates.push(`sms_enabled = $${pIdx++}`);
      params.push(prefs.smsEnabled);
    }
    if (prefs.pushEnabled !== undefined) {
      updates.push(`push_enabled = $${pIdx++}`);
      params.push(prefs.pushEnabled);
    }
    if (prefs.emailEnabled !== undefined) {
      updates.push(`email_enabled = $${pIdx++}`);
      params.push(prefs.emailEnabled);
    }

    const res = await query<{
      user_id: string;
      order_updates: boolean;
      promotional_alerts: boolean;
      delivery_status: boolean;
      sms_enabled: boolean;
      push_enabled: boolean;
      email_enabled: boolean;
    }>(
      `UPDATE notification.user_preferences
       SET ${updates.join(', ')}
       WHERE user_id = $1
       RETURNING user_id, order_updates, promotional_alerts, delivery_status, sms_enabled, push_enabled, email_enabled`,
      params
    );

    const row = res.rows[0]!;
    return {
      userId: row.user_id,
      orderUpdates: row.order_updates,
      promotionalAlerts: row.promotional_alerts,
      deliveryStatus: row.delivery_status,
      smsEnabled: row.sms_enabled,
      pushEnabled: row.push_enabled,
      emailEnabled: row.email_enabled,
    };
  }
}
