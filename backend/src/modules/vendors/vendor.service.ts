import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import {
  UpdateVendorProfileInput,
  CreateVendorAddressInput,
  UpdateVendorAddressInput,
  VendorQueryInput,
} from './vendor.validation.js';

export interface VendorAddressRecord {
  id: string;
  vendor_id: string;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  state: string;
  country: string;
  postal_code: string;
  latitude: number | null;
  longitude: number | null;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface VendorRecord {
  id: string;
  owner_user_id: string;
  business_name: string;
  business_code: string;
  description: string | null;
  phone: string;
  email: string;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  primary_address?: VendorAddressRecord | null;
  addresses?: VendorAddressRecord[];
}

export interface PaginatedVendors {
  vendors: VendorRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class VendorService {
  /**
   * List vendors with search, filtering, and pagination
   */
  public static async listVendors(filters: VendorQueryInput, isAdmin = false): Promise<PaginatedVendors> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['v.deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIndex = 1;

    // By default, public users only see ACTIVE vendors. Admins can view all statuses.
    if (filters.status) {
      conditions.push(`v.status = $${paramIndex++}`);
      values.push(filters.status);
    } else if (!isAdmin) {
      conditions.push(`v.status = 'ACTIVE'`);
    }

    if (filters.search) {
      conditions.push(
        `(v.business_name ILIKE $${paramIndex} OR v.business_code ILIKE $${paramIndex} OR v.description ILIKE $${paramIndex})`
      );
      values.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    if (filters.city) {
      conditions.push(`va.city ILIKE $${paramIndex++}`);
      values.push(`%${filters.city.trim()}%`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countQuery = `
      SELECT COUNT(DISTINCT v.id) as total
      FROM vendor.vendors v
      LEFT JOIN vendor.vendor_addresses va ON v.id = va.vendor_id AND va.is_primary = TRUE
      ${whereClause}
    `;
    const countRes = await query<{ total: string }>(countQuery, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Fetch Vendors with Primary Address
    const dataQuery = `
      SELECT 
        v.id, v.owner_user_id, v.business_name, v.business_code, v.description,
        v.phone, v.email, v.status, v.created_at, v.updated_at,
        json_build_object(
          'id', va.id,
          'address_line_1', va.address_line_1,
          'address_line_2', va.address_line_2,
          'city', va.city,
          'state', va.state,
          'country', va.country,
          'postal_code', va.postal_code,
          'latitude', va.latitude,
          'longitude', va.longitude,
          'is_primary', va.is_primary
        ) as primary_address
      FROM vendor.vendors v
      LEFT JOIN vendor.vendor_addresses va ON v.id = va.vendor_id AND va.is_primary = TRUE
      ${whereClause}
      ORDER BY v.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await query<VendorRecord>(dataQuery, values);

    return {
      vendors: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single vendor detail with all addresses
   */
  public static async getVendorById(vendorId: string): Promise<VendorRecord> {
    const vendorRes = await query<VendorRecord>(
      `SELECT id, owner_user_id, business_name, business_code, description, phone, email, status, created_at, updated_at, deleted_at
       FROM vendor.vendors
       WHERE id = $1 AND deleted_at IS NULL`,
      [vendorId]
    );

    const vendor = vendorRes.rows[0];
    if (!vendor) {
      throw new AppError('Vendor not found or has been deactivated.', 404, 'VENDOR_NOT_FOUND');
    }

    const addressesRes = await query<VendorAddressRecord>(
      `SELECT id, vendor_id, address_line_1, address_line_2, city, state, country, postal_code, latitude, longitude, is_primary, created_at, updated_at
       FROM vendor.vendor_addresses
       WHERE vendor_id = $1
       ORDER BY is_primary DESC, created_at ASC`,
      [vendorId]
    );

    vendor.addresses = addressesRes.rows;
    vendor.primary_address = addressesRes.rows.find((a) => a.is_primary) || null;

    return vendor;
  }

  /**
   * Resolve vendor profile owned by a specific user (for VENDOR role)
   */
  public static async getVendorByOwnerUserId(ownerUserId: string): Promise<VendorRecord> {
    const vendorRes = await query<VendorRecord>(
      `SELECT id, owner_user_id, business_name, business_code, description, phone, email, status, created_at, updated_at, deleted_at
       FROM vendor.vendors
       WHERE owner_user_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [ownerUserId]
    );

    const vendor = vendorRes.rows[0];
    if (!vendor) {
      throw new AppError('No vendor store profile registered under this account.', 404, 'VENDOR_NOT_FOUND');
    }

    return await this.getVendorById(vendor.id);
  }

  /**
   * Update vendor profile
   */
  public static async updateVendorProfile(
    vendorId: string,
    data: UpdateVendorProfileInput
  ): Promise<VendorRecord> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.businessName !== undefined) {
      fields.push(`business_name = $${index++}`);
      values.push(data.businessName.trim());
    }
    if (data.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(data.description.trim());
    }
    if (data.phone !== undefined) {
      fields.push(`phone = $${index++}`);
      values.push(data.phone.trim());
    }
    if (data.email !== undefined) {
      fields.push(`email = $${index++}`);
      values.push(data.email.trim().toLowerCase());
    }

    if (fields.length === 0) {
      return await this.getVendorById(vendorId);
    }

    values.push(vendorId);
    const updateQuery = `
      UPDATE vendor.vendors
      SET ${fields.join(', ')}
      WHERE id = $${index} AND deleted_at IS NULL
      RETURNING id
    `;

    const res = await query<{ id: string }>(updateQuery, values);
    if (!res.rows[0]) {
      throw new AppError('Vendor not found or could not be updated.', 404, 'VENDOR_NOT_FOUND');
    }

    return await this.getVendorById(vendorId);
  }

  /**
   * Update vendor approval or active status (Admin only)
   */
  public static async updateVendorStatus(vendorId: string, status: string): Promise<VendorRecord> {
    const res = await query<{ id: string }>(
      `UPDATE vendor.vendors
       SET status = $1
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [status, vendorId]
    );

    if (!res.rows[0]) {
      throw new AppError('Vendor not found.', 404, 'VENDOR_NOT_FOUND');
    }

    return await this.getVendorById(vendorId);
  }

  /**
   * Add storefront physical address
   */
  public static async addVendorAddress(
    vendorId: string,
    data: CreateVendorAddressInput
  ): Promise<VendorAddressRecord> {
    return await withTransaction(async (client) => {
      // If setting as primary, unset current primary address
      if (data.isPrimary) {
        await client.query(
          `UPDATE vendor.vendor_addresses SET is_primary = FALSE WHERE vendor_id = $1`,
          [vendorId]
        );
      }

      // Check if this is the vendor's first address; if so, force is_primary = TRUE
      const existingCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM vendor.vendor_addresses WHERE vendor_id = $1`,
        [vendorId]
      );
      const isFirst = parseInt(existingCount.rows[0]?.count || '0', 10) === 0;

      const res = await client.query<VendorAddressRecord>(
        `INSERT INTO vendor.vendor_addresses (
           vendor_id, address_line_1, address_line_2, city, state, country, postal_code,
           latitude, longitude, is_primary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          vendorId,
          data.addressLine1.trim(),
          data.addressLine2?.trim() || null,
          data.city.trim(),
          data.state.trim(),
          data.country?.trim() || 'India',
          data.postalCode.trim(),
          data.latitude ?? null,
          data.longitude ?? null,
          isFirst ? true : data.isPrimary ?? false,
        ]
      );

      return res.rows[0]!;
    });
  }

  /**
   * Update storefront address
   */
  public static async updateVendorAddress(
    addressId: string,
    vendorId: string,
    data: UpdateVendorAddressInput
  ): Promise<VendorAddressRecord> {
    return await withTransaction(async (client) => {
      if (data.isPrimary) {
        await client.query(
          `UPDATE vendor.vendor_addresses SET is_primary = FALSE WHERE vendor_id = $1`,
          [vendorId]
        );
      }

      const fields: string[] = [];
      const values: unknown[] = [];
      let index = 1;

      if (data.addressLine1 !== undefined) fields.push(`address_line_1 = $${index++}`), values.push(data.addressLine1.trim());
      if (data.addressLine2 !== undefined) fields.push(`address_line_2 = $${index++}`), values.push(data.addressLine2.trim());
      if (data.city !== undefined) fields.push(`city = $${index++}`), values.push(data.city.trim());
      if (data.state !== undefined) fields.push(`state = $${index++}`), values.push(data.state.trim());
      if (data.country !== undefined) fields.push(`country = $${index++}`), values.push(data.country.trim());
      if (data.postalCode !== undefined) fields.push(`postal_code = $${index++}`), values.push(data.postalCode.trim());
      if (data.latitude !== undefined) fields.push(`latitude = $${index++}`), values.push(data.latitude);
      if (data.longitude !== undefined) fields.push(`longitude = $${index++}`), values.push(data.longitude);
      if (data.isPrimary !== undefined) fields.push(`is_primary = $${index++}`), values.push(data.isPrimary);

      if (fields.length === 0) {
        const current = await client.query<VendorAddressRecord>(
          `SELECT * FROM vendor.vendor_addresses WHERE id = $1 AND vendor_id = $2`,
          [addressId, vendorId]
        );
        if (!current.rows[0]) throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
        return current.rows[0];
      }

      values.push(addressId, vendorId);
      const updateSql = `
        UPDATE vendor.vendor_addresses
        SET ${fields.join(', ')}
        WHERE id = $${index++} AND vendor_id = $${index++}
        RETURNING *
      `;

      const res = await client.query<VendorAddressRecord>(updateSql, values);
      if (!res.rows[0]) {
        throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
      }

      return res.rows[0];
    });
  }

  /**
   * Delete storefront address
   */
  public static async deleteVendorAddress(addressId: string, vendorId: string): Promise<void> {
    return await withTransaction(async (client) => {
      const addressRes = await client.query<VendorAddressRecord>(
        `SELECT id, is_primary FROM vendor.vendor_addresses WHERE id = $1 AND vendor_id = $2`,
        [addressId, vendorId]
      );

      const address = addressRes.rows[0];
      if (!address) {
        throw new AppError('Address not found.', 404, 'ADDRESS_NOT_FOUND');
      }

      // Check remaining addresses
      const countRes = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM vendor.vendor_addresses WHERE vendor_id = $1`,
        [vendorId]
      );
      if (parseInt(countRes.rows[0]?.count || '0', 10) <= 1) {
        throw new AppError('Cannot delete the only address of a vendor storefront.', 400, 'CANNOT_DELETE_LAST_ADDRESS');
      }

      await client.query(`DELETE FROM vendor.vendor_addresses WHERE id = $1`, [addressId]);

      // If deleted address was primary, promote the most recent remaining address
      if (address.is_primary) {
        await client.query(
          `UPDATE vendor.vendor_addresses
           SET is_primary = TRUE
           WHERE id = (
             SELECT id FROM vendor.vendor_addresses WHERE vendor_id = $1 ORDER BY created_at ASC LIMIT 1
           )`,
          [vendorId]
        );
      }
    });
  }

  /**
   * List staff members associated with a vendor
   */
  public static async getVendorStaff(vendorId: string): Promise<any[]> {
    const res = await query(
      `SELECT vu.id, vu.user_id, vu.designation, vu.status, vu.created_at,
              u.first_name, u.last_name, u.email, u.phone
       FROM vendor.vendor_users vu
       JOIN identity.users u ON vu.user_id = u.id
       WHERE vu.vendor_id = $1
       ORDER BY vu.created_at ASC`,
      [vendorId]
    );

    return res.rows;
  }

  /**
   * Add staff member to vendor
   */
  public static async addVendorStaff(vendorId: string, userId: string, designation: string): Promise<any> {
    // Check if user exists
    const userRes = await query<{ id: string }>(
      `SELECT id FROM identity.users WHERE id = $1 AND deleted_at IS NULL`,
      [userId]
    );
    if (!userRes.rows[0]) {
      throw new AppError('User not found in system.', 404, 'USER_NOT_FOUND');
    }

    try {
      const res = await query(
        `INSERT INTO vendor.vendor_users (vendor_id, user_id, designation, status)
         VALUES ($1, $2, $3, 'ACTIVE')
         RETURNING *`,
        [vendorId, userId, designation]
      );
      return res.rows[0];
    } catch (err: any) {
      if (err.code === '23505') {
        throw new AppError('User is already assigned to this vendor.', 409, 'STAFF_ALREADY_ASSIGNED');
      }
      throw err;
    }
  }

  /**
   * Remove staff member from vendor
   */
  public static async removeVendorStaff(vendorId: string, userId: string): Promise<void> {
    const res = await query(
      `DELETE FROM vendor.vendor_users WHERE vendor_id = $1 AND user_id = $2 RETURNING id`,
      [vendorId, userId]
    );

    if (!res.rows[0]) {
      throw new AppError('Staff member not found for this vendor.', 404, 'STAFF_NOT_FOUND');
    }
  }

  /**
   * Get UPI payment settings for a vendor store
   */
  public static async getPaymentSettings(vendorId: string): Promise<{
    upiId: string | null;
    upiQrUrl: string | null;
    upiPayUrl: string | null;
  }> {
    const res = await query<{ upi_id: string | null; upi_qr_url: string | null; upi_pay_url: string | null }>(
      `SELECT upi_id, upi_qr_url, upi_pay_url FROM vendor.vendors WHERE id = $1 AND deleted_at IS NULL`,
      [vendorId]
    );

    const vendor = res.rows[0];
    if (!vendor) {
      throw new AppError('Vendor not found.', 404, 'VENDOR_NOT_FOUND');
    }

    return {
      upiId: vendor.upi_id,
      upiQrUrl: vendor.upi_qr_url,
      upiPayUrl: vendor.upi_pay_url,
    };
  }

  /**
   * Update UPI payment settings for a vendor store
   * Strictly scoped: only the owning vendor or super admin may call this.
   */
  public static async updatePaymentSettings(
    vendorId: string,
    data: { upiId?: string; upiQrUrl?: string; upiPayUrl?: string }
  ): Promise<{ upiId: string | null; upiQrUrl: string | null; upiPayUrl: string | null }> {
    const setParts: string[] = [];
    const values: unknown[] = [];
    let paramIdx = 1;

    if (data.upiId !== undefined) {
      setParts.push(`upi_id = $${paramIdx++}`);
      values.push(data.upiId.trim() || null);
    }
    if (data.upiQrUrl !== undefined) {
      setParts.push(`upi_qr_url = $${paramIdx++}`);
      values.push(data.upiQrUrl.trim() || null);
    }
    if (data.upiPayUrl !== undefined) {
      setParts.push(`upi_pay_url = $${paramIdx++}`);
      values.push(data.upiPayUrl.trim() || null);
    }

    if (setParts.length === 0) {
      throw new AppError('No payment settings fields provided to update.', 400, 'NOTHING_TO_UPDATE');
    }

    setParts.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(vendorId);

    const res = await query<{ upi_id: string | null; upi_qr_url: string | null; upi_pay_url: string | null }>(
      `UPDATE vendor.vendors
       SET ${setParts.join(', ')}
       WHERE id = $${paramIdx} AND deleted_at IS NULL
       RETURNING upi_id, upi_qr_url, upi_pay_url`,
      values
    );

    if (!res.rows[0]) {
      throw new AppError('Vendor not found or update failed.', 404, 'VENDOR_NOT_FOUND');
    }

    const updated = res.rows[0];
    return {
      upiId: updated.upi_id,
      upiQrUrl: updated.upi_qr_url,
      upiPayUrl: updated.upi_pay_url,
    };
  }

  /**
   * Vendor: Update preferred UI language
   */
  public static async updateLanguage(
    vendorId: string,
    language: 'EN' | 'HI' | 'MR'
  ): Promise<{ preferredLanguage: 'EN' | 'HI' | 'MR'; message: string }> {
    await query(
      `UPDATE vendor.vendors SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [language, vendorId]
    );

    return {
      preferredLanguage: language,
      message: `Vendor language preference set to ${language} successfully.`,
    };
  }

  /**
   * Vendor: Soft-delete/deactivate store and account
   */
  public static async deactivateVendorAccount(vendorUserId: string): Promise<{ message: string }> {
    const vendor = await VendorService.getVendorByOwnerUserId(vendorUserId);

    // 1. Check if active in-progress orders exist
    const activeOrders = await query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM order_management.orders
       WHERE vendor_id = $1 AND status NOT IN ('DELIVERED', 'CANCELLED')`,
      [vendor.id]
    );

    if (parseInt(activeOrders.rows[0]?.count || '0', 10) > 0) {
      throw new AppError(
        'Cannot deactivate vendor account while there are active orders in progress.',
        400,
        'ACTIVE_ORDERS_IN_PROGRESS'
      );
    }

    await withTransaction(async (client) => {
      // Soft-delete vendor
      await client.query(
        `UPDATE vendor.vendors SET status = 'INACTIVE', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [vendor.id]
      );

      // Deactivate user
      await client.query(
        `UPDATE identity.users SET status = 'DEACTIVATED', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [vendorUserId]
      );

      // Revoke tokens
      await client.query(
        `UPDATE identity.refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [vendorUserId]
      );
    });

    return { message: 'Vendor store and account have been successfully deactivated.' };
  }
}


