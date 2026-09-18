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
}
