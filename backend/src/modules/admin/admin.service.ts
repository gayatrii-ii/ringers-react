import crypto from 'crypto';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';

export interface KeyRecord {
  id: string;
  key_code: string;
  status: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'REVOKED';
  expires_at: Date;
  used_by_vendor_id: string | null;
  created_by_admin_id: string;
  created_at: Date;
  updated_at: Date;
}

export class AdminService {
  /**
   * Generate a unique, single-use Private Registration Key for Vendors
   */
  public static async generatePrivateKey(
    adminUserId: string,
    expiryDays = 30,
    customCode?: string
  ): Promise<KeyRecord> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiryDays);

    let keyCode = customCode ? customCode.trim().toUpperCase() : '';

    if (!keyCode) {
      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      keyCode = `RNG-VND-${part1}-${part2}`;
    }

    // Ensure uniqueness
    const existing = await query(
      `SELECT id FROM identity.vendor_private_keys WHERE UPPER(key_code) = $1 LIMIT 1`,
      [keyCode]
    );

    if (existing.rows.length > 0) {
      throw new AppError('A private key with this code already exists.', 409, 'KEY_ALREADY_EXISTS');
    }

    const res = await query<KeyRecord>(
      `INSERT INTO identity.vendor_private_keys (
         key_code, status, expires_at, created_by_admin_id
       ) VALUES ($1, 'AVAILABLE', $2, $3)
       RETURNING *`,
      [keyCode, expiresAt, adminUserId]
    );

    return res.rows[0]!;
  }

  /**
   * List private keys with pagination, search, and status filtering
   */
  public static async listKeys(options: {
    status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'REVOKED';
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ keys: KeyRecord[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    // Automatically expire any available keys that passed expiration time
    await query(
      `UPDATE identity.vendor_private_keys
       SET status = 'EXPIRED'
       WHERE status = 'AVAILABLE' AND expires_at < CURRENT_TIMESTAMP`
    );

    const conditions: string[] = ['1=1'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (options.status) {
      conditions.push(`status = $${paramIndex++}`);
      values.push(options.status);
    }

    if (options.search) {
      conditions.push(`key_code ILIKE $${paramIndex++}`);
      values.push(`%${options.search.trim()}%`);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM identity.vendor_private_keys WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const keysRes = await query<KeyRecord>(
      `SELECT * FROM identity.vendor_private_keys
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
      [...values, limit, offset]
    );

    return {
      keys: keysRes.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Revoke an unused private key
   */
  public static async revokeKey(keyId: string, _adminUserId: string): Promise<KeyRecord> {
    const keyRes = await query<KeyRecord>(
      `SELECT * FROM identity.vendor_private_keys WHERE id = $1`,
      [keyId]
    );

    const key = keyRes.rows[0];
    if (!key) {
      throw new AppError('Private registration key not found.', 404, 'KEY_NOT_FOUND');
    }

    if (key.status !== 'AVAILABLE') {
      throw new AppError(
        `Cannot revoke key with status '${key.status}'. Only AVAILABLE keys can be revoked.`,
        400,
        'CANNOT_REVOKE'
      );
    }

    const updated = await query<KeyRecord>(
      `UPDATE identity.vendor_private_keys
       SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [keyId]
    );

    return updated.rows[0]!;
  }

  /**
   * Public: Prospective Vendor submits a registration request
   */
  public static async createVendorRequest(data: {
    businessName: string;
    shopName?: string;
    ownerName: string;
    mobile: string;
    email: string;
    businessDetails?: string;
  }): Promise<{ id: string; message: string }> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanMobile = data.mobile.trim();

    // Check if pending request exists
    const existing = await query(
      `SELECT id FROM identity.vendor_registration_requests
       WHERE (LOWER(email) = $1 OR mobile = $2) AND status = 'PENDING'
       LIMIT 1`,
      [cleanEmail, cleanMobile]
    );

    if (existing.rows.length > 0) {
      throw new AppError(
        'A pending registration request with this email or mobile number is already under review.',
        409,
        'REQUEST_PENDING'
      );
    }

    const res = await query<{ id: string }>(
      `INSERT INTO identity.vendor_registration_requests (
         business_name, shop_name, owner_name, mobile, email, business_details
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [data.businessName.trim(), data.shopName?.trim() || null, data.ownerName.trim(), cleanMobile, cleanEmail, data.businessDetails?.trim() || null]
    );

    return {
      id: res.rows[0]!.id,
      message: 'Vendor registration request submitted successfully. Super Admin will review.',
    };
  }

  /**
   * Super Admin: List vendor registration requests
   */
  public static async listVendorRequests(options: {
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`vrr.status = $${paramIdx++}`);
      values.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM identity.vendor_registration_requests vrr WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT vrr.*, vpk.key_code as generated_key_code
       FROM identity.vendor_registration_requests vrr
       LEFT JOIN identity.vendor_private_keys vpk ON vrr.generated_key_id = vpk.id
       WHERE ${whereClause}
       ORDER BY vrr.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    return { requests: res.rows, total, page, limit };
  }

  /**
   * Super Admin: Review Vendor Request (Approve generates Key atomically; Reject stores reason)
   */
  public static async reviewVendorRequest(
    requestId: string,
    adminUserId: string,
    action: 'APPROVED' | 'REJECTED',
    rejectionReason?: string,
    expiryDays = 14
  ) {
    return await withTransaction(async (client) => {
      const reqRes = await client.query(
        `SELECT * FROM identity.vendor_registration_requests WHERE id = $1 FOR UPDATE`,
        [requestId]
      );

      const request = reqRes.rows[0];
      if (!request) {
        throw new AppError('Registration request not found.', 404, 'NOT_FOUND');
      }

      if (request.status !== 'PENDING') {
        throw new AppError(`Request has already been ${request.status}.`, 400, 'ALREADY_PROCESSED');
      }

      if (action === 'REJECTED') {
        const updated = await client.query(
          `UPDATE identity.vendor_registration_requests
           SET status = 'REJECTED',
               reviewed_by_admin_id = $1,
               reviewed_at = CURRENT_TIMESTAMP,
               rejection_reason = $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3
           RETURNING *`,
          [adminUserId, rejectionReason?.trim() || 'Request rejected by platform administrator.', requestId]
        );
        return { request: updated.rows[0], key: null };
      }

      // APPROVE: Generate Private Key
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiryDays);

      const part1 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const part2 = crypto.randomBytes(3).toString('hex').toUpperCase();
      const keyCode = `RNG-APP-${part1}-${part2}`;

      const keyInsert = await client.query<KeyRecord>(
        `INSERT INTO identity.vendor_private_keys (
           key_code, status, expires_at, created_by_admin_id
         ) VALUES ($1, 'AVAILABLE', $2, $3)
         RETURNING *`,
        [keyCode, expiresAt, adminUserId]
      );

      const generatedKey = keyInsert.rows[0]!;

      const updatedReq = await client.query(
        `UPDATE identity.vendor_registration_requests
         SET status = 'APPROVED',
             generated_key_id = $1,
             reviewed_by_admin_id = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [generatedKey.id, adminUserId, requestId]
      );

      return { request: updatedReq.rows[0], key: generatedKey };
    });
  }

  /**
   * Public: Delivery Boy submits job application
   */
  public static async createDeliveryJobRequest(data: {
    fullName: string;
    mobile: string;
    email?: string;
    address: string;
    city: string;
    vehicleType?: string;
    drivingLicenseNumber?: string;
  }) {
    const res = await query<{ id: string }>(
      `INSERT INTO delivery.delivery_boy_job_requests (
         full_name, mobile, email, address, city, vehicle_type, driving_license_number
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        data.fullName.trim(),
        data.mobile.trim(),
        data.email?.trim().toLowerCase() || null,
        data.address.trim(),
        data.city.trim(),
        data.vehicleType?.trim() || null,
        data.drivingLicenseNumber?.trim() || null,
      ]
    );

    return {
      id: res.rows[0]!.id,
      message: 'Delivery Partner job request submitted successfully. Super Admin will review.',
    };
  }

  /**
   * Super Admin: List Delivery Boy Job Requests
   */
  public static async listDeliveryJobRequests(options: {
    status?: 'PENDING' | 'CONNECTED' | 'REJECTED';
    page?: number;
    limit?: number;
  }) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`dbr.status = $${paramIdx++}`);
      values.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM delivery.delivery_boy_job_requests dbr WHERE ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT dbr.*, v.business_name as assigned_vendor_name
       FROM delivery.delivery_boy_job_requests dbr
       LEFT JOIN vendor.vendors v ON dbr.assigned_vendor_id = v.id
       WHERE ${whereClause}
       ORDER BY dbr.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...values, limit, offset]
    );

    return { requests: res.rows, total, page, limit };
  }

  /**
   * Super Admin: Assign / Connect Delivery Boy Applicant to a Vendor
   */
  public static async assignDeliveryBoyToVendor(
    requestId: string,
    adminUserId: string,
    vendorId: string,
    notes?: string
  ) {
    // Verify vendor exists
    const vendorRes = await query(`SELECT id, business_name FROM vendor.vendors WHERE id = $1`, [vendorId]);
    if (vendorRes.rows.length === 0) {
      throw new AppError('Vendor not found.', 404, 'VENDOR_NOT_FOUND');
    }

    const updated = await query(
      `UPDATE delivery.delivery_boy_job_requests
       SET status = 'CONNECTED',
           assigned_vendor_id = $1,
           reviewed_by_admin_id = $2,
           reviewed_at = CURRENT_TIMESTAMP,
           notes = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [vendorId, adminUserId, notes?.trim() || null, requestId]
    );

    if (updated.rows.length === 0) {
      throw new AppError('Delivery boy job request not found.', 404, 'NOT_FOUND');
    }

    return {
      request: updated.rows[0],
      assignedVendor: vendorRes.rows[0],
    };
  }

  /**
   * Super Admin: Platform Metrics Overview (Enriched with Orders, GMV, and Payments)
   */
  public static async getPlatformMetrics() {
    const [vendorsCount, productsCount, usersCount, pendingVendorReqs, pendingDeliveryReqs, orderMetricsRes, paymentMetricsRes] = await Promise.all([
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text as count FROM vendor.vendors WHERE deleted_at IS NULL GROUP BY status`
      ),
      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text as count FROM catalog.products WHERE deleted_at IS NULL GROUP BY status`
      ),
      query<{ code: string; count: string }>(
        `SELECT r.code, COUNT(ur.user_id)::text as count
         FROM identity.roles r
         LEFT JOIN identity.user_roles ur ON r.id = ur.role_id
         GROUP BY r.code`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM identity.vendor_registration_requests WHERE status = 'PENDING'`
      ),
      query<{ count: string }>(
        `SELECT COUNT(*)::text as count FROM delivery.delivery_boy_job_requests WHERE status = 'PENDING'`
      ),
      query<{ total_orders: string; total_gmv: string; completed_orders: string; cancelled_orders: string }>(
        `SELECT 
           COUNT(*)::text as total_orders,
           COALESCE(SUM(total_amount), 0)::text as total_gmv,
           COUNT(*) FILTER (WHERE status = 'DELIVERED')::text as completed_orders,
           COUNT(*) FILTER (WHERE status = 'CANCELLED')::text as cancelled_orders
         FROM order_management.orders`
      ),
      query<{ payment_method: string; count: string; volume: string }>(
        `SELECT payment_method, COUNT(*)::text as count, COALESCE(SUM(total_amount), 0)::text as volume
         FROM order_management.orders
         GROUP BY payment_method`
      ),
    ]);

    const orderStats = orderMetricsRes.rows[0];

    return {
      vendors: vendorsCount.rows,
      products: productsCount.rows,
      roles: usersCount.rows,
      totalOrders: parseInt(orderStats?.total_orders || '0', 10),
      totalGmv: parseFloat(orderStats?.total_gmv || '0'),
      completedOrders: parseInt(orderStats?.completed_orders || '0', 10),
      cancelledOrders: parseInt(orderStats?.cancelled_orders || '0', 10),
      paymentBreakdown: paymentMetricsRes.rows.map((r) => ({
        method: r.payment_method,
        count: parseInt(r.count, 10),
        volume: parseFloat(r.volume),
      })),
      pendingVendorRequests: parseInt(pendingVendorReqs.rows[0]?.count || '0', 10),
      pendingDeliveryRequests: parseInt(pendingDeliveryReqs.rows[0]?.count || '0', 10),
    };
  }

  /**
   * Super Admin: Update Customer Account Status (ACTIVE / SUSPENDED)
   */
  public static async updateCustomerStatus(
    customerId: string,
    status: 'ACTIVE' | 'SUSPENDED'
  ): Promise<{ customerId: string; status: string; message: string }> {
    const userRes = await query<{ id: string }>(
      `SELECT u.id FROM identity.users u
       JOIN identity.user_roles ur ON ur.user_id = u.id
       JOIN identity.roles r ON r.id = ur.role_id AND r.code = 'CUSTOMER'
       WHERE u.id = $1`,
      [customerId]
    );

    if (userRes.rows.length === 0) {
      throw new AppError('Customer not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    await withTransaction(async (client) => {
      await client.query(
        `UPDATE identity.users SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [status, customerId]
      );

      // If suspended, revoke refresh tokens
      if (status === 'SUSPENDED') {
        await client.query(
          `UPDATE identity.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
          [customerId]
        );
      }
    });

    return {
      customerId,
      status,
      message: `Customer account status updated to ${status} successfully.`,
    };
  }

  /**
   * Super Admin: List all vendors with status filter and search
   */
  public static async listAdminVendors(options: {
    status?: string;
    search?: string;
    city?: string;
    page?: number;
    limit?: number;
  }): Promise<{ vendors: any[]; total: number; page: number; limit: number }> {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['v.deleted_at IS NULL'];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.status) {
      conditions.push(`v.status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.city) {
      conditions.push(`EXISTS (SELECT 1 FROM vendor.vendor_addresses va WHERE va.vendor_id = v.id AND va.city ILIKE $${pIdx++})`);
      params.push(`%${options.city}%`);
    }

    if (options.search) {
      conditions.push(`(v.business_name ILIKE $${pIdx} OR u.phone ILIKE $${pIdx} OR u.email ILIKE $${pIdx})`);
      params.push(`%${options.search}%`);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count
       FROM vendor.vendors v
       JOIN identity.users u ON u.id = v.owner_user_id
       WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT v.id, v.business_name, v.description, v.status, v.phone, v.email,
              v.rating, v.total_reviews, v.restrict_customer_catalog, v.referral_code,
              u.first_name as owner_first_name, u.last_name as owner_last_name,
              u.phone as owner_phone, u.email as owner_email,
              v.created_at, v.updated_at
       FROM vendor.vendors v
       JOIN identity.users u ON u.id = v.owner_user_id
       WHERE ${whereClause}
       ORDER BY v.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx++}`,
      [...params, limit, offset]
    );

    return { vendors: res.rows, total, page, limit };
  }

  /**
   * Public: Check Vendor Registration Request Status
   */
  public static async getPublicVendorRequestStatus(mobile: string) {
    const res = await query<{
      id: string;
      business_name: string;
      status: string;
      rejection_reason: string | null;
      key_code: string | null;
      created_at: Date;
    }>(
      `SELECT vrr.id, vrr.business_name, vrr.status, vrr.rejection_reason,
              vpk.key_code, vrr.created_at
       FROM identity.vendor_registration_requests vrr
       LEFT JOIN identity.vendor_private_keys vpk ON vpk.id = vrr.generated_key_id
       WHERE vrr.mobile = $1
       ORDER BY vrr.created_at DESC
       LIMIT 1`,
      [mobile.trim()]
    );

    if (res.rows.length === 0) {
      throw new AppError('No application found for this mobile number.', 404, 'APPLICATION_NOT_FOUND');
    }

    return res.rows[0];
  }

  /**
   * Public: Check Delivery Boy Job Request Status
   */
  public static async getPublicDeliveryJobRequestStatus(mobile: string) {
    const res = await query<{
      id: string;
      full_name: string;
      status: string;
      assigned_vendor_id: string | null;
      vendor_name: string | null;
      created_at: Date;
    }>(
      `SELECT jr.id, jr.full_name, jr.status, jr.assigned_vendor_id,
              v.business_name as vendor_name, jr.created_at
       FROM delivery.delivery_boy_job_requests jr
       LEFT JOIN vendor.vendors v ON v.id = jr.assigned_vendor_id
       WHERE jr.mobile = $1
       ORDER BY jr.created_at DESC
       LIMIT 1`,
      [mobile.trim()]
    );

    if (res.rows.length === 0) {
      throw new AppError('No job application found for this mobile number.', 404, 'APPLICATION_NOT_FOUND');
    }

    return res.rows[0];
  }
}

