import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES } from '../../constants/roles.js';

export class VendorDeliveryOnboardingService {
  /**
   * Helper: Get vendor store owned by user
   */
  private static async getVendorByOwnerId(userId: string): Promise<string> {
    const res = await query<{ id: string }>(
      `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('Vendor store not found for this user.', 404, 'VENDOR_NOT_FOUND');
    }

    return res.rows[0].id;
  }

  /**
   * Vendor: List delivery boy job applications connected to this vendor store
   */
  public static async listConnectedRequests(
    vendorUserId: string,
    options: {
      status?: 'CONNECTED' | 'ACTIVATED';
      page?: number;
      limit?: number;
    }
  ): Promise<{ requests: any[]; total: number; page: number; limit: number }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['assigned_vendor_id = $1'];
    const params: unknown[] = [vendorId];
    let paramIdx = 2;

    if (options.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM delivery.delivery_boy_job_requests WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT id, full_name, mobile, email, address, city, vehicle_type, driving_license_number,
              status, assigned_vendor_id, activated_user_id, notes, created_at, updated_at
       FROM delivery.delivery_boy_job_requests
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    return { requests: res.rows, total, page, limit };
  }

  /**
   * Vendor: Activate delivery boy account and provision login credentials
   */
  public static async activateDeliveryBoy(
    vendorUserId: string,
    jobRequestId: string,
    passwordPlain: string
  ): Promise<{
    deliveryBoyId: string;
    fullName: string;
    mobile: string;
    email: string | null;
    status: string;
    message: string;
  }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    return await withTransaction(async (client) => {
      // 1. Fetch request with lock
      const reqRes = await client.query<{
        id: string;
        full_name: string;
        mobile: string;
        email: string | null;
        address: string;
        city: string;
        vehicle_type: string | null;
        driving_license_number: string | null;
        status: string;
        assigned_vendor_id: string;
      }>(
        `SELECT * FROM delivery.delivery_boy_job_requests 
         WHERE id = $1 AND assigned_vendor_id = $2 FOR UPDATE`,
        [jobRequestId, vendorId]
      );

      if (reqRes.rows.length === 0 || !reqRes.rows[0]) {
        throw new AppError('Job request not found or not connected to your vendor store.', 404, 'REQUEST_NOT_FOUND');
      }

      const req = reqRes.rows[0];

      if (req.status === 'ACTIVATED') {
        throw new AppError('This delivery partner account is already activated.', 400, 'ALREADY_ACTIVATED');
      }

      if (req.status !== 'CONNECTED') {
        throw new AppError(
          `Cannot activate job request in status "${req.status}". It must be approved and connected by Super Admin.`,
          400,
          'NOT_CONNECTED_BY_ADMIN'
        );
      }

      // Check if phone already registered in identity.users
      const phoneCheck = await client.query(
        `SELECT id FROM identity.users WHERE phone = $1 AND deleted_at IS NULL`,
        [req.mobile]
      );

      if (phoneCheck.rows.length > 0) {
        throw new AppError('A user account with this mobile number already exists.', 409, 'PHONE_ALREADY_EXISTS');
      }

      // Split full name into first and last name
      const nameParts = req.full_name.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Delivery';
      const lastName = nameParts.slice(1).join(' ') || 'Partner';

      // 2. Hash password
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(passwordPlain, salt);

      // 3. Create identity.users
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO identity.users (
           first_name, last_name, email, phone, password_hash, status, is_verified
         ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', TRUE)
         RETURNING id`,
        [
          firstName,
          lastName,
          req.email || `${req.mobile.replace(/[^0-9]/g, '')}@rider.ringer.local`,
          req.mobile,
          passwordHash,
        ]
      );

      const riderUserId = userRes.rows[0]!.id;

      // 4. Assign DELIVERY_BOY role
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM identity.roles WHERE code = $1`,
        [ROLES.DELIVERY_BOY]
      );

      if (roleRes.rows.length === 0 || !roleRes.rows[0]) {
        throw new AppError('Delivery boy role not found in system.', 500, 'ROLE_MISSING');
      }

      await client.query(
        `INSERT INTO identity.user_roles (user_id, role_id) VALUES ($1, $2)`,
        [riderUserId, roleRes.rows[0].id]
      );

      // 5. Create delivery_profiles
      const validVehicleTypes = ['BIKE', 'SCOOTER', 'CYCLE', 'VAN', 'OTHER'];
      const vehicleType = req.vehicle_type && validVehicleTypes.includes(req.vehicle_type.toUpperCase())
        ? req.vehicle_type.toUpperCase()
        : 'BIKE';

      await client.query(
        `INSERT INTO delivery.delivery_profiles (
           user_id, vehicle_type, license_number, status
         ) VALUES ($1, $2, $3, 'OFFLINE')`,
        [riderUserId, vehicleType, req.driving_license_number || null]
      );

      // 6. Update job request to ACTIVATED
      await client.query(
        `UPDATE delivery.delivery_boy_job_requests 
         SET status = 'ACTIVATED', activated_user_id = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [riderUserId, jobRequestId]
      );

      return {
        deliveryBoyId: riderUserId,
        fullName: req.full_name,
        mobile: req.mobile,
        email: req.email,
        status: 'ACTIVATED',
        message: 'Delivery partner account created successfully. Rider may now log in with their phone and password.',
      };
    });
  }

  /**
   * Vendor: List all active and connected delivery boys in vendor's fleet
   */
  public static async listVendorDeliveryBoys(
    vendorUserId: string,
    filters: { status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; page?: number; limit?: number }
  ): Promise<{
    riders: Array<{
      riderId: string;
      fullName: string;
      phone: string;
      email: string | null;
      accountStatus: string;
      dutyStatus: string;
      vehicleType: string;
      licenseNumber: string | null;
      activeDeliveries: number;
      completedDeliveries: number;
      activatedAt: Date;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['jr.assigned_vendor_id = $1', "jr.status = 'ACTIVATED'", 'u.deleted_at IS NULL'];
    const params: unknown[] = [vendorId];
    let pIdx = 2;

    if (filters.status) {
      conditions.push(`u.status = $${pIdx++}`);
      params.push(filters.status);
    }

    const whereClause = conditions.join(' AND ');

    // Total count
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT u.id) AS count
       FROM delivery.delivery_boy_job_requests jr
       JOIN identity.users u ON u.id = jr.activated_user_id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    // List riders with active/completed metrics
    const dataRes = await query<{
      rider_id: string;
      first_name: string;
      last_name: string;
      phone: string;
      email: string | null;
      account_status: string;
      duty_status: string | null;
      vehicle_type: string | null;
      license_number: string | null;
      active_deliveries: string;
      completed_deliveries: string;
      activated_at: Date;
    }>(
      `SELECT 
         u.id AS rider_id,
         u.first_name,
         u.last_name,
         u.phone,
         u.email,
         u.status AS account_status,
         dp.status AS duty_status,
         dp.vehicle_type,
         dp.license_number,
         COUNT(da.id) FILTER (WHERE da.status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP')) AS active_deliveries,
         COUNT(da.id) FILTER (WHERE da.status = 'DELIVERED') AS completed_deliveries,
         jr.updated_at AS activated_at
       FROM delivery.delivery_boy_job_requests jr
       JOIN identity.users u ON u.id = jr.activated_user_id
       LEFT JOIN delivery.delivery_profiles dp ON dp.user_id = u.id
       LEFT JOIN delivery.delivery_assignments da ON da.delivery_boy_id = u.id
       WHERE ${whereClause}
       GROUP BY u.id, u.first_name, u.last_name, u.phone, u.email, u.status, dp.status, dp.vehicle_type, dp.license_number, jr.updated_at
       ORDER BY u.first_name ASC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    const riders = dataRes.rows.map((row) => ({
      riderId: row.rider_id,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      phone: row.phone,
      email: row.email,
      accountStatus: row.account_status,
      dutyStatus: row.duty_status || 'OFFLINE',
      vehicleType: row.vehicle_type || 'BIKE',
      licenseNumber: row.license_number || null,
      activeDeliveries: parseInt(row.active_deliveries || '0', 10),
      completedDeliveries: parseInt(row.completed_deliveries || '0', 10),
      activatedAt: row.activated_at,
    }));

    return { riders, total, page, limit };
  }

  /**
   * Vendor: Toggle rider account status (ACTIVE / INACTIVE / SUSPENDED)
   */
  public static async updateVendorRiderStatus(
    vendorUserId: string,
    riderId: string,
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  ): Promise<{ riderId: string; status: string; message: string }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    // Verify this rider belongs to this vendor
    const checkRes = await query<{ id: string }>(
      `SELECT id FROM delivery.delivery_boy_job_requests 
       WHERE assigned_vendor_id = $1 AND activated_user_id = $2`,
      [vendorId, riderId]
    );

    if (checkRes.rows.length === 0) {
      throw new AppError('Delivery rider not found or not registered under your store.', 404, 'RIDER_NOT_FOUND');
    }

    await query(
      `UPDATE identity.users 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [status, riderId]
    );

    return {
      riderId,
      status,
      message: `Delivery rider status updated to ${status} successfully.`,
    };
  }

  /**
   * Flow A: Directly create and provision Delivery Boy account for Vendor
   */
  public static async createDirectDeliveryBoy(
    vendorUserId: string,
    data: {
      firstName: string;
      lastName: string;
      mobile: string;
      email?: string;
      password: string;
      vehicleType?: 'BIKE' | 'SCOOTER' | 'CYCLE' | 'ELECTRIC_VEHICLE';
      licenseNumber?: string;
      profilePhotoUrl?: string;
    }
  ): Promise<{
    deliveryBoyId: string;
    fullName: string;
    mobile: string;
    email: string | null;
    status: string;
    message: string;
  }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    return await withTransaction(async (client) => {
      // 1. Check if mobile already exists in users
      const existingUser = await client.query(
        `SELECT id FROM identity.users WHERE phone = $1 LIMIT 1`,
        [data.mobile]
      );
      if (existingUser.rows.length > 0) {
        throw new AppError('A user with this mobile number already exists.', 409, 'PHONE_ALREADY_EXISTS');
      }

      // 2. Hash password
      const passwordHash = await bcrypt.hash(data.password, 12);

      // 3. Insert user with DELIVERY_BOY role
      const userRes = await client.query<{ id: string }>(
        `INSERT INTO identity.users (first_name, last_name, phone, email, password_hash, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING id`,
        [data.firstName, data.lastName, data.mobile, data.email || null, passwordHash]
      );
      if (!userRes.rows[0]) {
        throw new AppError('Failed to create delivery boy user', 500, 'USER_CREATION_FAILED');
      }
      const deliveryBoyUserId = userRes.rows[0].id;

      // 4. Assign DELIVERY_BOY role
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM identity.roles WHERE name = $1 LIMIT 1`,
        [ROLES.DELIVERY_BOY]
      );
      if (roleRes.rows[0]) {
        await client.query(
          `INSERT INTO identity.user_roles (user_id, role_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [deliveryBoyUserId, roleRes.rows[0].id]
        );
      }

      // 5. Create delivery profile
      await client.query(
        `INSERT INTO delivery.delivery_profiles (user_id, vehicle_type, license_number, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'OFFLINE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (user_id) DO UPDATE 
         SET vehicle_type = EXCLUDED.vehicle_type, license_number = EXCLUDED.license_number, updated_at = CURRENT_TIMESTAMP`,
        [deliveryBoyUserId, data.vehicleType || 'BIKE', data.licenseNumber || null]
      );

      // 6. Record in delivery_boy_job_requests to associate with vendor
      await client.query(
        `INSERT INTO delivery.delivery_boy_job_requests 
         (full_name, mobile, email, address, city, vehicle_type, driving_license_number, status, assigned_vendor_id, activated_user_id, notes, created_at, updated_at)
         VALUES ($1, $2, $3, 'Created directly by vendor', 'Local', $4, $5, 'ACTIVATED', $6, $7, 'Vendor Direct Onboarding', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          `${data.firstName} ${data.lastName}`.trim(),
          data.mobile,
          data.email || null,
          data.vehicleType || 'BIKE',
          data.licenseNumber || null,
          vendorId,
          deliveryBoyUserId,
        ]
      );

      return {
        deliveryBoyId: deliveryBoyUserId,
        fullName: `${data.firstName} ${data.lastName}`.trim(),
        mobile: data.mobile,
        email: data.email || null,
        status: 'ACTIVE',
        message: 'Delivery Boy account created and associated with your store successfully.',
      };
    });
  }

  /**
   * Vendor: Reset password for a delivery partner in their fleet
   */
  public static async resetRiderPassword(
    vendorUserId: string,
    riderId: string,
    newPasswordPlain: string
  ): Promise<{ message: string }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    // Verify this rider belongs to this vendor
    const checkRes = await query<{ id: string }>(
      `SELECT id FROM delivery.delivery_boy_job_requests 
       WHERE assigned_vendor_id = $1 AND activated_user_id = $2`,
      [vendorId, riderId]
    );

    if (checkRes.rows.length === 0) {
      throw new AppError('Delivery rider not found or not registered under your store.', 404, 'RIDER_NOT_FOUND');
    }

    const passwordHash = await bcrypt.hash(newPasswordPlain, 12);

    await withTransaction(async (client) => {
      // 1. Update password
      await client.query(
        `UPDATE identity.users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [passwordHash, riderId]
      );

      // 2. Revoke any existing active refresh tokens
      await client.query(
        `UPDATE identity.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
        [riderId]
      );
    });

    return { message: 'Delivery partner password has been reset successfully.' };
  }
}

