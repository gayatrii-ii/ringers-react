import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';

export interface CustomerProfileResponse {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string | null;
  gender: string | null;
  profileImage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerAddress {
  id: string;
  userId: string;
  addressType: 'HOME' | 'WORK' | 'OTHER';
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileInput {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY' | null;
  profileImage?: string | null;
}

export interface CreateAddressInput {
  addressType: 'HOME' | 'WORK' | 'OTHER';
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  country?: string;
  postalCode: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export interface UpdateAddressInput {
  addressType?: 'HOME' | 'WORK' | 'OTHER';
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
}

export class CustomerService {
  /**
   * Get complete customer profile by user ID
   */
  public static async getProfile(userId: string): Promise<CustomerProfileResponse> {
    const res = await query(
      `SELECT 
         u.id AS user_id,
         u.first_name,
         u.last_name,
         u.email,
         u.phone,
         p.id AS profile_id,
         p.date_of_birth,
         p.gender,
         p.profile_image,
         COALESCE(p.created_at, u.created_at) AS created_at,
         COALESCE(p.updated_at, u.updated_at) AS updated_at
       FROM identity.users u
       LEFT JOIN customer.customer_profiles p ON p.user_id = u.id
       WHERE u.id = $1 AND u.deleted_at IS NULL`,
      [userId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new AppError('Customer user not found', 404, 'USER_NOT_FOUND');
    }

    return {
      id: row.profile_id || row.user_id,
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
      dateOfBirth: row.date_of_birth ? row.date_of_birth.toISOString?.().split('T')[0] || String(row.date_of_birth) : null,
      gender: row.gender || null,
      profileImage: row.profile_image || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update customer personal profile (first name, last name, DOB, gender, profile photo)
   */
  public static async updateProfile(userId: string, data: UpdateProfileInput): Promise<CustomerProfileResponse> {
    return await withTransaction(async (client) => {
      // 1. Update identity.users name if provided
      if (data.firstName !== undefined || data.lastName !== undefined) {
        const userUpdates: string[] = [];
        const userParams: unknown[] = [];
        let pIdx = 1;

        if (data.firstName !== undefined) {
          userUpdates.push(`first_name = $${pIdx++}`);
          userParams.push(data.firstName.trim());
        }
        if (data.lastName !== undefined) {
          userUpdates.push(`last_name = $${pIdx++}`);
          userParams.push(data.lastName.trim());
        }

        userUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
        userParams.push(userId);

        await client.query(
          `UPDATE identity.users 
           SET ${userUpdates.join(', ')} 
           WHERE id = $${pIdx} AND deleted_at IS NULL`,
          userParams
        );
      }

      // 2. Check if customer profile already exists
      const existingRes = await client.query(
        `SELECT id, date_of_birth, gender, profile_image FROM customer.customer_profiles WHERE user_id = $1`,
        [userId]
      );

      if (existingRes.rows.length === 0) {
        // Insert new profile
        await client.query(
          `INSERT INTO customer.customer_profiles (user_id, date_of_birth, gender, profile_image)
           VALUES ($1, $2, $3, $4)`,
          [
            userId,
            data.dateOfBirth || null,
            data.gender || null,
            data.profileImage || null,
          ]
        );
      } else {
        // Update existing profile
        const profUpdates: string[] = [];
        const profParams: unknown[] = [];
        let pIdx = 1;

        if (data.dateOfBirth !== undefined) {
          profUpdates.push(`date_of_birth = $${pIdx++}`);
          profParams.push(data.dateOfBirth);
        }
        if (data.gender !== undefined) {
          profUpdates.push(`gender = $${pIdx++}`);
          profParams.push(data.gender);
        }
        if (data.profileImage !== undefined) {
          profUpdates.push(`profile_image = $${pIdx++}`);
          profParams.push(data.profileImage);
        }

        if (profUpdates.length > 0) {
          profUpdates.push(`updated_at = CURRENT_TIMESTAMP`);
          profParams.push(userId);

          await client.query(
            `UPDATE customer.customer_profiles 
             SET ${profUpdates.join(', ')} 
             WHERE user_id = $${pIdx}`,
            profParams
          );
        }
      }

      // 3. Return full merged profile
      const res = await client.query(
        `SELECT 
           u.id AS user_id,
           u.first_name,
           u.last_name,
           u.email,
           u.phone,
           p.id AS profile_id,
           p.date_of_birth,
           p.gender,
           p.profile_image,
           COALESCE(p.created_at, u.created_at) AS created_at,
           COALESCE(p.updated_at, u.updated_at) AS updated_at
         FROM identity.users u
         LEFT JOIN customer.customer_profiles p ON p.user_id = u.id
         WHERE u.id = $1`,
        [userId]
      );

      const row = res.rows[0];
      return {
        id: row.profile_id || row.user_id,
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dateOfBirth: row.date_of_birth ? row.date_of_birth.toISOString?.().split('T')[0] || String(row.date_of_birth) : null,
        gender: row.gender || null,
        profileImage: row.profile_image || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
  }

  /**
   * List all saved active delivery addresses for customer
   */
  public static async listAddresses(userId: string): Promise<CustomerAddress[]> {
    const res = await query(
      `SELECT 
         id,
         user_id,
         address_type,
         address_line_1,
         address_line_2,
         city,
         state,
         country,
         postal_code,
         latitude,
         longitude,
         is_default,
         created_at,
         updated_at
       FROM customer.addresses
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY is_default DESC, created_at DESC`,
      [userId]
    );

    return res.rows.map(CustomerService.mapAddressRow);
  }

  /**
   * Get single address by ID
   */
  public static async getAddressById(userId: string, addressId: string): Promise<CustomerAddress> {
    const res = await query(
      `SELECT 
         id,
         user_id,
         address_type,
         address_line_1,
         address_line_2,
         city,
         state,
         country,
         postal_code,
         latitude,
         longitude,
         is_default,
         created_at,
         updated_at
       FROM customer.addresses
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [addressId, userId]
    );

    const row = res.rows[0];
    if (!row) {
      throw new AppError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
    }

    return CustomerService.mapAddressRow(row);
  }

  /**
   * Create a new delivery address
   * Atomically flips previous default if new address is marked as default
   */
  public static async createAddress(userId: string, data: CreateAddressInput): Promise<CustomerAddress> {
    return await withTransaction(async (client) => {
      // Check existing address count
      const countRes = await client.query(
        `SELECT COUNT(*) AS total FROM customer.addresses WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId]
      );
      const isFirst = parseInt(countRes.rows[0].total, 10) === 0;

      // Force default if it's the first address, or if explicitly requested
      const shouldBeDefault = isFirst || Boolean(data.isDefault);

      if (shouldBeDefault) {
        await client.query(
          `UPDATE customer.addresses 
           SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND deleted_at IS NULL`,
          [userId]
        );
      }

      const res = await client.query(
        `INSERT INTO customer.addresses (
           user_id,
           address_type,
           address_line_1,
           address_line_2,
           city,
           state,
           country,
           postal_code,
           latitude,
           longitude,
           is_default
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          userId,
          data.addressType,
          data.addressLine1.trim(),
          data.addressLine2 ? data.addressLine2.trim() : null,
          data.city.trim(),
          data.state.trim(),
          data.country ? data.country.trim() : 'India',
          data.postalCode.trim(),
          data.latitude ?? null,
          data.longitude ?? null,
          shouldBeDefault,
        ]
      );

      return CustomerService.mapAddressRow(res.rows[0]);
    });
  }

  /**
   * Update existing address
   */
  public static async updateAddress(
    userId: string,
    addressId: string,
    data: UpdateAddressInput
  ): Promise<CustomerAddress> {
    return await withTransaction(async (client) => {
      // Ensure address exists
      const existing = await client.query(
        `SELECT id, is_default FROM customer.addresses WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [addressId, userId]
      );

      if (existing.rows.length === 0) {
        throw new AppError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
      }

      // If updating to default, unset others
      if (data.isDefault === true) {
        await client.query(
          `UPDATE customer.addresses 
           SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
           WHERE user_id = $1 AND deleted_at IS NULL`,
          [userId]
        );
      }

      const updates: string[] = [];
      const params: unknown[] = [];
      let pIdx = 1;

      if (data.addressType !== undefined) {
        updates.push(`address_type = $${pIdx++}`);
        params.push(data.addressType);
      }
      if (data.addressLine1 !== undefined) {
        updates.push(`address_line_1 = $${pIdx++}`);
        params.push(data.addressLine1.trim());
      }
      if (data.addressLine2 !== undefined) {
        updates.push(`address_line_2 = $${pIdx++}`);
        params.push(data.addressLine2 ? data.addressLine2.trim() : null);
      }
      if (data.city !== undefined) {
        updates.push(`city = $${pIdx++}`);
        params.push(data.city.trim());
      }
      if (data.state !== undefined) {
        updates.push(`state = $${pIdx++}`);
        params.push(data.state.trim());
      }
      if (data.country !== undefined) {
        updates.push(`country = $${pIdx++}`);
        params.push(data.country.trim());
      }
      if (data.postalCode !== undefined) {
        updates.push(`postal_code = $${pIdx++}`);
        params.push(data.postalCode.trim());
      }
      if (data.latitude !== undefined) {
        updates.push(`latitude = $${pIdx++}`);
        params.push(data.latitude);
      }
      if (data.longitude !== undefined) {
        updates.push(`longitude = $${pIdx++}`);
        params.push(data.longitude);
      }
      if (data.isDefault !== undefined) {
        updates.push(`is_default = $${pIdx++}`);
        params.push(data.isDefault);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(addressId);
      params.push(userId);

      const res = await client.query(
        `UPDATE customer.addresses
         SET ${updates.join(', ')}
         WHERE id = $${pIdx++} AND user_id = $${pIdx} AND deleted_at IS NULL
         RETURNING *`,
        params
      );

      return CustomerService.mapAddressRow(res.rows[0]);
    });
  }

  /**
   * Soft-delete address
   * If deleted address was default, auto-promotes the most recent active address to default
   */
  public static async deleteAddress(userId: string, addressId: string): Promise<void> {
    await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE customer.addresses 
         SET deleted_at = CURRENT_TIMESTAMP, is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL 
         RETURNING id, is_default`,
        [addressId, userId]
      );

      if (res.rows.length === 0) {
        throw new AppError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
      }

      const wasDefault = res.rows[0].is_default;

      // If deleted was default, promote next available address
      if (wasDefault) {
        await client.query(
          `UPDATE customer.addresses
           SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = (
             SELECT id FROM customer.addresses
             WHERE user_id = $1 AND deleted_at IS NULL
             ORDER BY created_at DESC
             LIMIT 1
           )`,
          [userId]
        );
      }
    });
  }

  /**
   * Set specific address as the primary/default delivery address
   */
  public static async setDefaultAddress(userId: string, addressId: string): Promise<CustomerAddress> {
    return await withTransaction(async (client) => {
      // 1. Unset existing default
      await client.query(
        `UPDATE customer.addresses 
         SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP 
         WHERE user_id = $1 AND deleted_at IS NULL`,
        [userId]
      );

      // 2. Set target address to default
      const res = await client.query(
        `UPDATE customer.addresses
         SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
         RETURNING *`,
        [addressId, userId]
      );

      if (res.rows.length === 0) {
        throw new AppError('Delivery address not found', 404, 'ADDRESS_NOT_FOUND');
      }

      return CustomerService.mapAddressRow(res.rows[0]);
    });
  }

  /**
   * Helper to map raw DB row to CustomerAddress model
   */
  private static mapAddressRow(row: any): CustomerAddress {
    return {
      id: row.id,
      userId: row.user_id,
      addressType: row.address_type,
      addressLine1: row.address_line_1,
      addressLine2: row.address_line_2 || null,
      city: row.city,
      state: row.state,
      country: row.country,
      postalCode: row.postal_code,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      isDefault: Boolean(row.is_default),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
