import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';

export interface DeliveryProfileResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  vehicleType: 'BIKE' | 'SCOOTER' | 'CYCLE' | 'VAN' | 'OTHER';
  vehicleNumber: string | null;
  licenseNumber: string | null;
  status: 'OFFLINE' | 'ONLINE' | 'BUSY' | 'SUSPENDED';
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateDeliveryProfileInput {
  vehicleType?: 'BIKE' | 'SCOOTER' | 'CYCLE' | 'VAN' | 'OTHER';
  vehicleNumber?: string | null;
  licenseNumber?: string | null;
}

export interface DeliveryStatsResponse {
  currentDutyStatus: 'OFFLINE' | 'ONLINE' | 'BUSY' | 'SUSPENDED';
  totalAssigned: number;
  completedDeliveries: number;
  activeAssignment: {
    id: string;
    orderId: string;
    status: string;
    assignedAt: Date;
  } | null;
}

export class DeliveryService {
  /**
   * Get complete delivery rider profile by user ID
   * Auto-initializes delivery profile if user holds delivery role but has no record yet
   */
  public static async getProfile(userId: string): Promise<DeliveryProfileResponse> {
    // Check if user exists
    const userRes = await query(
      `SELECT id, first_name, last_name, email, phone FROM identity.users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError('Delivery partner user not found', 404, 'USER_NOT_FOUND');
    }

    const user = userRes.rows[0];
    if (!user) {
      throw new AppError('Delivery partner user not found', 404, 'USER_NOT_FOUND');
    }

    // Fetch delivery profile
    let profileRes = await query(
      `SELECT id, user_id, vehicle_type, vehicle_number, license_number, status, created_at, updated_at
       FROM delivery.delivery_profiles
       WHERE user_id = $1`,
      [userId]
    );

    // Auto-create default profile if row doesn't exist
    if (profileRes.rows.length === 0) {
      profileRes = await query(
        `INSERT INTO delivery.delivery_profiles (user_id, vehicle_type, status)
         VALUES ($1, 'BIKE', 'OFFLINE')
         RETURNING id, user_id, vehicle_type, vehicle_number, license_number, status, created_at, updated_at`,
        [userId]
      );
    }

    const profile = profileRes.rows[0];
    if (!profile) {
      throw new AppError('Could not initialize delivery profile', 500, 'PROFILE_INIT_FAILED');
    }

    return {
      id: profile.id,
      userId: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      phone: user.phone,
      vehicleType: profile.vehicle_type,
      vehicleNumber: profile.vehicle_number || null,
      licenseNumber: profile.license_number || null,
      status: profile.status,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  /**
   * Update delivery partner vehicle profile
   */
  public static async updateProfile(
    userId: string,
    data: UpdateDeliveryProfileInput
  ): Promise<DeliveryProfileResponse> {
    return await withTransaction(async (client) => {
      // 1. Ensure user exists
      const userRes = await client.query(
        `SELECT id, first_name, last_name, email, phone FROM identity.users WHERE id = $1 AND deleted_at IS NULL`,
        [userId]
      );

      if (userRes.rows.length === 0) {
        throw new AppError('Delivery partner user not found', 404, 'USER_NOT_FOUND');
      }

      const user = userRes.rows[0];

      // 2. Check if delivery profile exists
      const existing = await client.query(
        `SELECT id FROM delivery.delivery_profiles WHERE user_id = $1`,
        [userId]
      );

      let profileRow: any;

      if (existing.rows.length === 0) {
        // Insert new
        const insertRes = await client.query(
          `INSERT INTO delivery.delivery_profiles (user_id, vehicle_type, vehicle_number, license_number, status)
           VALUES ($1, $2, $3, $4, 'OFFLINE')
           RETURNING *`,
          [
            userId,
            data.vehicleType || 'BIKE',
            data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null,
            data.licenseNumber ? data.licenseNumber.trim().toUpperCase() : null,
          ]
        );
        profileRow = insertRes.rows[0];
      } else {
        // Update existing
        const updates: string[] = [];
        const params: unknown[] = [];
        let pIdx = 1;

        if (data.vehicleType !== undefined) {
          updates.push(`vehicle_type = $${pIdx++}`);
          params.push(data.vehicleType);
        }
        if (data.vehicleNumber !== undefined) {
          updates.push(`vehicle_number = $${pIdx++}`);
          params.push(data.vehicleNumber ? data.vehicleNumber.trim().toUpperCase() : null);
        }
        if (data.licenseNumber !== undefined) {
          updates.push(`license_number = $${pIdx++}`);
          params.push(data.licenseNumber ? data.licenseNumber.trim().toUpperCase() : null);
        }

        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        params.push(userId);

        const updateRes = await client.query(
          `UPDATE delivery.delivery_profiles
           SET ${updates.join(', ')}
           WHERE user_id = $${pIdx}
           RETURNING *`,
          params
        );
        profileRow = updateRes.rows[0];
      }

      return {
        id: profileRow.id,
        userId: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        vehicleType: profileRow.vehicle_type,
        vehicleNumber: profileRow.vehicle_number || null,
        licenseNumber: profileRow.license_number || null,
        status: profileRow.status,
        createdAt: profileRow.created_at,
        updatedAt: profileRow.updated_at,
      };
    });
  }

  /**
   * Update duty status (ONLINE, OFFLINE, BUSY)
   * Guarded: Suspended riders cannot go online; active riders on delivery cannot go offline
   */
  public static async updateDutyStatus(
    userId: string,
    newStatus: 'ONLINE' | 'OFFLINE' | 'BUSY'
  ): Promise<{ status: string; message: string }> {
    return await withTransaction(async (client) => {
      // 1. Fetch current profile with row-level lock
      const profileRes = await client.query(
        `SELECT id, status FROM delivery.delivery_profiles WHERE user_id = $1 FOR UPDATE`,
        [userId]
      );

      if (profileRes.rows.length === 0) {
        throw new AppError('Delivery profile not found. Please complete profile registration first.', 404, 'PROFILE_NOT_FOUND');
      }

      const currentStatus = profileRes.rows[0].status;

      // 2. Check suspension
      if (currentStatus === 'SUSPENDED') {
        throw new AppError(
          'Your delivery partner account has been suspended by administration. Contact support.',
          403,
          'ACCOUNT_SUSPENDED'
        );
      }

      // 3. If going OFFLINE, verify rider is not in the middle of active delivery
      if (newStatus === 'OFFLINE') {
        const activeRes = await client.query(
          `SELECT id, order_id, status 
           FROM delivery.delivery_assignments 
           WHERE delivery_boy_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP') 
           LIMIT 1`,
          [userId]
        );

        if (activeRes.rows.length > 0) {
          throw new AppError(
            'Cannot go OFFLINE while an active delivery assignment is in progress. Complete or reassign current order first.',
            400,
            'ACTIVE_DELIVERY_IN_PROGRESS'
          );
        }
      }

      // 4. Update status
      await client.query(
        `UPDATE delivery.delivery_profiles 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $2`,
        [newStatus, userId]
      );

      return {
        status: newStatus,
        message: `Duty status switched to ${newStatus}`,
      };
    });
  }

  /**
   * Get rider statistics and active delivery summary
   */
  public static async getStats(userId: string): Promise<DeliveryStatsResponse> {
    // 1. Current duty status
    const profileRes = await query(
      `SELECT status FROM delivery.delivery_profiles WHERE user_id = $1`,
      [userId]
    );

    const currentDutyStatus = profileRes.rows[0]?.status || 'OFFLINE';

    // 2. Total lifetime assigned & completed count
    const statsRes = await query(
      `SELECT 
         COUNT(*) AS total_assigned,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') AS total_completed
       FROM delivery.delivery_assignments
       WHERE delivery_boy_id = $1`,
      [userId]
    );

    const totalAssigned = parseInt(statsRes.rows[0]?.total_assigned || '0', 10);
    const completedDeliveries = parseInt(statsRes.rows[0]?.total_completed || '0', 10);

    // 3. Current active assignment
    const activeRes = await query(
      `SELECT id, order_id, status, assigned_at
       FROM delivery.delivery_assignments
       WHERE delivery_boy_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP')
       ORDER BY assigned_at DESC
       LIMIT 1`,
      [userId]
    );

    let activeAssignment: DeliveryStatsResponse['activeAssignment'] = null;
    if (activeRes.rows.length > 0 && activeRes.rows[0]) {
      const a = activeRes.rows[0];
      activeAssignment = {
        id: a.id,
        orderId: a.order_id,
        status: a.status,
        assignedAt: a.assigned_at,
      };
    }

    return {
      currentDutyStatus,
      totalAssigned,
      completedDeliveries,
      activeAssignment,
    };
  }

  /**
   * Super Admin / Admin: List all delivery riders with pagination and duty filters
   */
  public static async adminListRiders(filter: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    riders: DeliveryProfileResponse[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: unknown[] = [];
    let pIdx = 1;

    if (filter.status) {
      conditions.push(`dp.status = $${pIdx++}`);
      params.push(filter.status);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count
    const countRes = await query(
      `SELECT COUNT(*) AS total
       FROM identity.users u
       JOIN identity.user_roles ur ON ur.user_id = u.id
       JOIN identity.roles r ON r.id = ur.role_id AND r.code = 'DELIVERY_BOY'
       LEFT JOIN delivery.delivery_profiles dp ON dp.user_id = u.id
       ${whereClause}`,
      params
    );

    const total = parseInt(countRes.rows[0]?.total || '0', 10);


    // Paginated records
    params.push(limit);
    params.push(offset);

    const res = await query(
      `SELECT 
         COALESCE(dp.id, u.id) AS id,
         u.id AS user_id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         COALESCE(dp.vehicle_type, 'BIKE') AS vehicle_type,
         dp.vehicle_number,
         dp.license_number,
         COALESCE(dp.status, 'OFFLINE') AS status,
         COALESCE(dp.created_at, u.created_at) AS created_at,
         COALESCE(dp.updated_at, u.updated_at) AS updated_at
       FROM identity.users u
       JOIN identity.user_roles ur ON ur.user_id = u.id
       JOIN identity.roles r ON r.id = ur.role_id AND r.code = 'DELIVERY_BOY'
       LEFT JOIN delivery.delivery_profiles dp ON dp.user_id = u.id
       ${whereClause}
       ORDER BY dp.status = 'ONLINE' DESC, u.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    const riders: DeliveryProfileResponse[] = res.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      vehicleType: row.vehicle_type,
      vehicleNumber: row.vehicle_number || null,
      licenseNumber: row.license_number || null,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { riders, total, page, limit };
  }

  /**
   * Super Admin: Update rider status (e.g. SUSPENDED, OFFLINE)
   */
  public static async adminSetRiderStatus(
    riderUserId: string,
    status: 'OFFLINE' | 'ONLINE' | 'BUSY' | 'SUSPENDED'
  ): Promise<{ status: string; message: string }> {
    const res = await query(
      `UPDATE delivery.delivery_profiles 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $2 
       RETURNING status`,
      [status, riderUserId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Delivery profile not found for specified rider ID', 404, 'RIDER_NOT_FOUND');
    }

    return {
      status,
      message: `Rider account status updated to ${status}`,
    };
  }

  /**
   * Rider: Update preferred UI language
   */
  public static async updateLanguage(
    riderUserId: string,
    language: 'EN' | 'HI' | 'MR'
  ): Promise<{ preferredLanguage: 'EN' | 'HI' | 'MR'; message: string }> {
    await query(
      `UPDATE delivery.delivery_profiles SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [language, riderUserId]
    );

    return {
      preferredLanguage: language,
      message: `Delivery partner language preference set to ${language} successfully.`,
    };
  }

  /**
   * Rider: Soft-delete/deactivate account
   */
  public static async deactivateRiderAccount(riderUserId: string): Promise<{ message: string }> {
    // 1. Check if active deliveries in progress
    const activeAssignments = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM delivery.delivery_assignments
       WHERE delivery_boy_id = $1 AND status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP')`,
      [riderUserId]
    );

    if (parseInt(activeAssignments.rows[0]?.count || '0', 10) > 0) {
      throw new AppError(
        'Cannot deactivate rider account while you have active deliveries in progress.',
        400,
        'ACTIVE_DELIVERIES_IN_PROGRESS'
      );
    }

    await withTransaction(async (client) => {
      // Mark profile OFFLINE
      await client.query(
        `UPDATE delivery.delivery_profiles SET status = 'OFFLINE', updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [riderUserId]
      );

      // Deactivate user
      await client.query(
        `UPDATE identity.users SET status = 'DEACTIVATED', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [riderUserId]
      );

      // Revoke tokens
      await client.query(
        `UPDATE identity.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [riderUserId]
      );
    });

    return { message: 'Delivery partner account has been successfully deactivated.' };
  }
}

