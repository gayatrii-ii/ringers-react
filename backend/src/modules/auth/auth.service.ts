import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES, RoleCode } from '../../constants/roles.js';
import { TokenService } from './token.service.js';
import { env } from '../../config/env.js';

export interface UserDTO {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  roles: RoleCode[];
  vendorId?: string;
  status: string;
}

export interface AuthResponse {
  user: UserDTO;
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export class AuthService {
  /**
   * Universal Login Handler for all 4 roles (Super Admin, Vendor, Delivery Boy, Customer)
   * Supports email or phone as identifier.
   */
  public static async login(identifier: string, passwordPlain: string): Promise<AuthResponse> {
    const trimmedId = identifier.trim().toLowerCase();

    // Query user by email OR phone
    const userRes = await query<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      password_hash: string;
      status: string;
      is_verified: boolean;
      deleted_at: Date | null;
    }>(
      `SELECT id, first_name, last_name, email, phone, password_hash, status, is_verified, deleted_at
       FROM identity.users
       WHERE (LOWER(email) = $1 OR phone = $2) AND deleted_at IS NULL
       LIMIT 1`,
      [trimmedId, identifier.trim()]
    );

    const user = userRes.rows[0];

    if (!user) {
      throw new AppError('Invalid email/phone or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError('Invalid email/phone or password.', 401, 'INVALID_CREDENTIALS');
    }

    // Check account status
    if (user.status !== 'ACTIVE') {
      throw new AppError(
        `Your account status is ${user.status}. Please contact support.`,
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    // Retrieve user roles
    const rolesRes = await query<{ code: RoleCode }>(
      `SELECT r.code
       FROM identity.user_roles ur
       JOIN identity.roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    const roles = rolesRes.rows.map((r) => r.code);

    if (roles.length === 0) {
      throw new AppError('No platform role assigned to this account.', 403, 'NO_ROLE_ASSIGNED');
    }

    // If user is a Vendor, look up vendor store ID
    let vendorId: string | undefined;
    if (roles.includes(ROLES.VENDOR)) {
      const vendorRes = await query<{ id: string }>(
        `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [user.id]
      );
      vendorId = vendorRes.rows[0]?.id;
    }

    // Generate tokens
    const accessToken = TokenService.signAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      roles,
    });

    const refreshToken = await TokenService.generateRefreshToken(user.id);

    return {
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        phone: user.phone,
        roles,
        vendorId,
        status: user.status,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Vendor Registration using Single-Use Private Registration Key
   * Validates key status, expiry, hashes password, creates user + vendor record atomically.
   */
  public static async registerVendorWithPrivateKey(data: {
    privateKey: string;
    businessName: string;
    businessCode: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    password: string;
    description?: string;
  }): Promise<AuthResponse> {
    const trimmedKey = data.privateKey.trim().toUpperCase();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = data.phone.trim();
    const cleanCode = data.businessCode.trim().toLowerCase();

    return await withTransaction(async (client) => {
      // 1. Lock and validate Private Key
      const keyRes = await client.query<{
        id: string;
        status: string;
        expires_at: Date;
      }>(
        `SELECT id, status, expires_at
         FROM identity.vendor_private_keys
         WHERE UPPER(key_code) = $1
         FOR UPDATE`,
        [trimmedKey]
      );

      const keyRecord = keyRes.rows[0];

      if (!keyRecord) {
        throw new AppError('Invalid private registration key provided.', 400, 'INVALID_PRIVATE_KEY');
      }

      if (keyRecord.status !== 'AVAILABLE') {
        throw new AppError(
          `Private registration key is not available (Status: ${keyRecord.status}). Each key can only be used once.`,
          400,
          'KEY_NOT_AVAILABLE'
        );
      }

      if (new Date(keyRecord.expires_at) < new Date()) {
        // Mark as EXPIRED in DB
        await client.query(
          `UPDATE identity.vendor_private_keys SET status = 'EXPIRED' WHERE id = $1`,
          [keyRecord.id]
        );
        throw new AppError(
          'Private registration key has expired. Please request a new key from the Super Admin.',
          400,
          'KEY_EXPIRED'
        );
      }

      // 2. Check uniqueness of email and phone
      const existingUser = await client.query(
        `SELECT id FROM identity.users WHERE LOWER(email) = $1 OR phone = $2 LIMIT 1`,
        [cleanEmail, cleanPhone]
      );

      if (existingUser.rows.length > 0) {
        throw new AppError(
          'An account with this email or phone number already exists.',
          409,
          'USER_ALREADY_EXISTS'
        );
      }

      // 3. Check uniqueness of business code
      const existingVendor = await client.query(
        `SELECT id FROM vendor.vendors WHERE LOWER(business_code) = $1 LIMIT 1`,
        [cleanCode]
      );

      if (existingVendor.rows.length > 0) {
        throw new AppError(
          'Business code is already registered by another vendor. Please choose a unique code.',
          409,
          'BUSINESS_CODE_TAKEN'
        );
      }

      // 4. Hash password with bcrypt (salt rounds = 10)
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);

      // 5. Create user in identity.users
      const userInsert = await client.query<{ id: string }>(
        `INSERT INTO identity.users (
           first_name, last_name, email, phone, password_hash, status, is_verified
         ) VALUES ($1, $2, $3, $4, $5, 'ACTIVE', TRUE)
         RETURNING id`,
        [data.firstName.trim(), data.lastName.trim(), cleanEmail, cleanPhone, passwordHash]
      );

      const userId = userInsert.rows[0]!.id;

      // 6. Assign VENDOR role
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM identity.roles WHERE code = 'VENDOR' LIMIT 1`
      );

      if (!roleRes.rows[0]) {
        throw new AppError('Vendor role not initialized in database.', 500, 'ROLE_NOT_CONFIGURED');
      }

      await client.query(
        `INSERT INTO identity.user_roles (user_id, role_id) VALUES ($1, $2)`,
        [userId, roleRes.rows[0].id]
      );

      // 7. Create vendor record in vendor.vendors
      const vendorInsert = await client.query<{ id: string }>(
        `INSERT INTO vendor.vendors (
           owner_user_id, business_name, business_code, description, phone, email, status
         ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
         RETURNING id`,
        [userId, data.businessName.trim(), cleanCode, data.description?.trim() || null, cleanPhone, cleanEmail]
      );

      const vendorId = vendorInsert.rows[0]!.id;

      // 8. Mark Private Key as USED
      await client.query(
        `UPDATE identity.vendor_private_keys
         SET status = 'USED', used_by_vendor_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [vendorId, keyRecord.id]
      );

      // 9. Issue tokens
      const roles: RoleCode[] = [ROLES.VENDOR];
      const accessToken = TokenService.signAccessToken({
        userId,
        email: cleanEmail,
        phone: cleanPhone,
        roles,
      });

      const refreshToken = await TokenService.generateRefreshToken(userId);

      return {
        user: {
          id: userId,
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          roles,
          vendorId,
          status: 'ACTIVE',
        },
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    });
  }

  /**
   * OTP Generation Service
   */
  public static async sendOtp(
    phone: string,
    purpose: 'VERIFICATION' | 'LOGIN' | 'PASSWORD_RESET' | 'DELIVERY_CONFIRMATION' = 'VERIFICATION'
  ): Promise<{ message: string; expiresInSeconds: number }> {
    const cleanPhone = phone.trim();

    // Generate cryptographic 6-digit numeric OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();

    // Hash OTP code
    const salt = await bcrypt.genSalt(10);
    const otpHash = await bcrypt.hash(otpCode, salt);

    // 5 minutes expiry
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await query(
      `INSERT INTO identity.otps (phone, otp_code_hash, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [cleanPhone, otpHash, purpose, expiresAt]
    );

    if (env.NODE_ENV !== 'production') {
      console.log(`📱 [DEV OTP SERVICE] Phone: ${cleanPhone} | Purpose: ${purpose} | OTP: ${otpCode}`);
    }

    return {
      message: 'OTP sent successfully to mobile number',
      expiresInSeconds: 300,
    };
  }

  /**
   * OTP Verification Service
   */
  public static async verifyOtp(
    phone: string,
    otpCode: string,
    purpose: 'VERIFICATION' | 'LOGIN' | 'PASSWORD_RESET' | 'DELIVERY_CONFIRMATION' = 'VERIFICATION'
  ): Promise<boolean> {
    const cleanPhone = phone.trim();

    const otpRes = await query<{
      id: string;
      otp_code_hash: string;
      attempts: number;
      expires_at: Date;
    }>(
      `SELECT id, otp_code_hash, attempts, expires_at
       FROM identity.otps
       WHERE phone = $1 AND purpose = $2 AND is_verified = FALSE
       ORDER BY created_at DESC
       LIMIT 1`,
      [cleanPhone, purpose]
    );

    const record = otpRes.rows[0];

    if (!record) {
      throw new AppError('No active OTP found for this phone number.', 400, 'OTP_NOT_FOUND');
    }

    if (record.attempts >= 5) {
      throw new AppError('Too many failed OTP attempts. Please request a new OTP.', 429, 'TOO_MANY_ATTEMPTS');
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new AppError('OTP has expired. Please request a new one.', 400, 'OTP_EXPIRED');
    }

    // Validate code
    const isValid = await bcrypt.compare(otpCode, record.otp_code_hash);

    if (!isValid) {
      // Increment attempts
      await query(`UPDATE identity.otps SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
      throw new AppError('Invalid OTP code. Please check and try again.', 400, 'INVALID_OTP');
    }

    // Mark verified
    await query(`UPDATE identity.otps SET is_verified = TRUE WHERE id = $1`, [record.id]);

    return true;
  }
}
