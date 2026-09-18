import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES } from '../../constants/roles.js';
import { AuthService } from '../auth/auth.service.js';
import { NotificationService } from '../notifications/notification.service.js';

export interface CustomerRegistrationRequestRecord {
  id: string;
  vendorId: string;
  initiatedBy: 'VENDOR' | 'CUSTOMER';
  firstName: string;
  lastName: string;
  phone: string;
  email: string | null;
  photoUrl: string | null;
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  status: 'PENDING' | 'OTP_VERIFIED' | 'ACTIVATED' | 'REJECTED';
  notes: string | null;
  activatedUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class CustomerOnboardingService {
  /**
   * Helper: Retrieve vendor ID owned by user
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
   * Flow B: Customer submits direct registration request for a selected vendor (Public)
   */
  public static async submitDirectCustomerRequest(data: {
    vendorId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email?: string | null;
    photoUrl?: string | null;
    addressLine1: string;
    city: string;
    state: string;
    postalCode: string;
    notes?: string | null;
  }): Promise<{ id: string; status: string; message: string }> {
    // 1. Check if vendor exists & is ACTIVE
    const vendorRes = await query<{ id: string; business_name: string; owner_user_id: string }>(
      `SELECT id, business_name, owner_user_id FROM vendor.vendors WHERE id = $1 AND status = 'ACTIVE' AND deleted_at IS NULL`,
      [data.vendorId]
    );

    if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
      throw new AppError('The selected vendor is not available or active.', 404, 'VENDOR_NOT_AVAILABLE');
    }

    const vendor = vendorRes.rows[0];

    // 2. Check if phone is already registered as an active user
    const existingUser = await query<{ id: string }>(
      `SELECT id FROM identity.users WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
      [data.phone.trim()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError(
        'This phone number is already registered in the platform. Please log in directly.',
        409,
        'PHONE_ALREADY_EXISTS'
      );
    }

    // 3. Check if there is already an active pending request for this phone and vendor
    const existingReq = await query<{ id: string }>(
      `SELECT id FROM customer.registration_requests 
       WHERE vendor_id = $1 AND phone = $2 AND status IN ('PENDING', 'OTP_VERIFIED')`,
      [data.vendorId, data.phone.trim()]
    );

    if (existingReq.rows.length > 0) {
      throw new AppError(
        'A registration request for this mobile number is already pending review by the vendor.',
        409,
        'DUPLICATE_PENDING_REQUEST'
      );
    }

    // 4. Create request record
    const insertRes = await query<{ id: string }>(
      `INSERT INTO customer.registration_requests (
         vendor_id, initiated_by, first_name, last_name, phone, email, photo_url,
         address_line_1, city, state, postal_code, status, notes
       ) VALUES ($1, 'CUSTOMER', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
       RETURNING id`,
      [
        data.vendorId,
        data.firstName.trim(),
        data.lastName.trim(),
        data.phone.trim(),
        data.email?.trim().toLowerCase() || null,
        data.photoUrl?.trim() || null,
        data.addressLine1.trim(),
        data.city.trim(),
        data.state.trim(),
        data.postalCode.trim(),
        data.notes?.trim() || null,
      ]
    );

    const requestId = insertRes.rows[0]!.id;

    // 5. Notify vendor of incoming registration request
    try {
      await NotificationService.createNotification({
        userId: vendor.owner_user_id,
        title: 'New Customer Registration Request',
        message: `Customer ${data.firstName} ${data.lastName} (${data.phone}) submitted a registration request for your store.`,
        type: 'SYSTEM',
        referenceType: 'CUSTOMER_REQUEST',
        referenceId: requestId,
      });
    } catch (err) {
      console.warn('Notification to vendor failed:', err);
    }

    return {
      id: requestId,
      status: 'PENDING',
      message: `Your registration request has been submitted to ${vendor.business_name}. The vendor will review and provision your account.`,
    };
  }

  /**
   * Flow A: Vendor initiates customer registration request & triggers verification OTP
   */
  public static async vendorInitiateCustomerRequest(
    vendorUserId: string,
    data: {
      firstName: string;
      lastName: string;
      phone: string;
      email?: string | null;
      photoUrl?: string | null;
      addressLine1: string;
      city: string;
      state: string;
      postalCode: string;
      notes?: string | null;
    }
  ): Promise<{ requestId: string; phone: string; status: string; message: string }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    // Verify phone is not already registered
    const existingUser = await query<{ id: string }>(
      `SELECT id FROM identity.users WHERE phone = $1 AND deleted_at IS NULL LIMIT 1`,
      [data.phone.trim()]
    );

    if (existingUser.rows.length > 0) {
      throw new AppError('This phone number is already registered in the platform.', 409, 'PHONE_ALREADY_EXISTS');
    }

    // Insert request record
    const insertRes = await query<{ id: string }>(
      `INSERT INTO customer.registration_requests (
         vendor_id, initiated_by, first_name, last_name, phone, email, photo_url,
         address_line_1, city, state, postal_code, status, notes
       ) VALUES ($1, 'VENDOR', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING', $11)
       RETURNING id`,
      [
        vendorId,
        data.firstName.trim(),
        data.lastName.trim(),
        data.phone.trim(),
        data.email?.trim().toLowerCase() || null,
        data.photoUrl?.trim() || null,
        data.addressLine1.trim(),
        data.city.trim(),
        data.state.trim(),
        data.postalCode.trim(),
        data.notes?.trim() || null,
      ]
    );

    const requestId = insertRes.rows[0]!.id;

    // Send verification OTP to customer
    await AuthService.sendOtp(data.phone.trim(), 'VERIFICATION');

    return {
      requestId,
      phone: data.phone.trim(),
      status: 'PENDING',
      message: 'Customer registration request created. Verification OTP dispatched to customer phone.',
    };
  }

  /**
   * Flow A: Vendor verifies customer's OTP
   */
  public static async vendorVerifyCustomerOtp(
    vendorUserId: string,
    requestId: string,
    otpCode: string
  ): Promise<{ requestId: string; status: string; message: string }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    const reqRes = await query<{ id: string; phone: string; status: string }>(
      `SELECT id, phone, status FROM customer.registration_requests 
       WHERE id = $1 AND vendor_id = $2`,
      [requestId, vendorId]
    );

    if (reqRes.rows.length === 0 || !reqRes.rows[0]) {
      throw new AppError('Registration request not found for your vendor store.', 404, 'REQUEST_NOT_FOUND');
    }

    const req = reqRes.rows[0];

    if (req.status !== 'PENDING') {
      throw new AppError(
        `Request cannot be verified in status ${req.status}. Must be PENDING.`,
        400,
        'INVALID_REQUEST_STATUS'
      );
    }

    // Verify OTP
    await AuthService.verifyOtp(req.phone, otpCode, 'VERIFICATION');

    // Update status to OTP_VERIFIED
    await query(
      `UPDATE customer.registration_requests 
       SET status = 'OTP_VERIFIED', updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [requestId]
    );

    return {
      requestId,
      status: 'OTP_VERIFIED',
      message: 'Customer phone verified successfully. Vendor can now configure products, pricing, and activate the account.',
    };
  }

  /**
   * Activate Customer Account (Used for both Flow A after OTP, and Flow B after review)
   */
  public static async activateCustomer(
    vendorUserId: string,
    requestId: string,
    passwordPlain: string,
    selectedProducts?: Array<{
      productId: string;
      isEnabled: boolean;
      customPrice?: number | null;
    }>,
    notes?: string | null
  ): Promise<{
    customerId: string;
    firstName: string;
    lastName: string;
    phone: string;
    email: string | null;
    status: string;
    message: string;
  }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    return await withTransaction(async (client) => {
      // 1. Fetch request with lock
      const reqRes = await client.query<{
        id: string;
        vendor_id: string;
        initiated_by: string;
        first_name: string;
        last_name: string;
        phone: string;
        email: string | null;
        photo_url: string | null;
        address_line_1: string | null;
        city: string | null;
        state: string | null;
        postal_code: string | null;
        status: string;
      }>(
        `SELECT * FROM customer.registration_requests 
         WHERE id = $1 AND vendor_id = $2 FOR UPDATE`,
        [requestId, vendorId]
      );

      if (reqRes.rows.length === 0 || !reqRes.rows[0]) {
        throw new AppError('Registration request not found for your vendor store.', 404, 'REQUEST_NOT_FOUND');
      }

      const req = reqRes.rows[0];

      if (req.status === 'ACTIVATED') {
        throw new AppError('This customer account is already activated.', 400, 'ALREADY_ACTIVATED');
      }

      if (req.status === 'REJECTED') {
        throw new AppError('Cannot activate a rejected registration request.', 400, 'REQUEST_REJECTED');
      }

      // For Flow A (vendor initiated), require OTP_VERIFIED
      if (req.initiated_by === 'VENDOR' && req.status !== 'OTP_VERIFIED') {
        throw new AppError(
          'Customer must complete OTP verification before account activation.',
          400,
          'OTP_NOT_VERIFIED'
        );
      }

      // Ensure phone is not registered concurrently
      const checkUser = await client.query(
        `SELECT id FROM identity.users WHERE phone = $1 AND deleted_at IS NULL`,
        [req.phone]
      );

      if (checkUser.rows.length > 0) {
        throw new AppError('A user account with this phone already exists.', 409, 'PHONE_ALREADY_EXISTS');
      }

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
          req.first_name,
          req.last_name,
          req.email || `${req.phone.replace(/[^0-9]/g, '')}@customer.ringer.local`,
          req.phone,
          passwordHash,
        ]
      );

      const customerUserId = userRes.rows[0]!.id;

      // 4. Assign CUSTOMER role
      const roleRes = await client.query<{ id: string }>(
        `SELECT id FROM identity.roles WHERE code = $1`,
        [ROLES.CUSTOMER]
      );

      if (roleRes.rows.length === 0 || !roleRes.rows[0]) {
        throw new AppError('Customer role not configured in system.', 500, 'ROLE_MISSING');
      }

      await client.query(
        `INSERT INTO identity.user_roles (user_id, role_id) VALUES ($1, $2)`,
        [customerUserId, roleRes.rows[0].id]
      );

      // 5. Create customer_profiles
      await client.query(
        `INSERT INTO customer.customer_profiles (user_id, profile_image)
         VALUES ($1, $2)`,
        [customerUserId, req.photo_url]
      );

      // 6. Create default address if address was provided
      if (req.address_line_1 && req.city && req.state && req.postal_code) {
        await client.query(
          `INSERT INTO customer.addresses (
             user_id, address_type, address_line_1, city, state, country, postal_code, is_default
           ) VALUES ($1, 'HOME', $2, $3, $4, 'India', $5, TRUE)`,
          [customerUserId, req.address_line_1, req.city, req.state, req.postal_code]
        );
      }

      // 7. Initialize customer wallet (₹0.00)
      await client.query(
        `INSERT INTO payment.wallets (user_id, balance, currency, is_active)
         VALUES ($1, 0.00, 'INR', TRUE)
         ON CONFLICT (user_id) DO NOTHING`,
        [customerUserId]
      );

      // 8. Associate selected products & pricing if provided
      if (selectedProducts && selectedProducts.length > 0) {
        for (const item of selectedProducts) {
          await client.query(
            `INSERT INTO vendor.customer_products (
               vendor_id, customer_user_id, product_id, is_enabled, custom_price
             ) VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (vendor_id, customer_user_id, product_id)
             DO UPDATE SET is_enabled = EXCLUDED.is_enabled, 
                           custom_price = EXCLUDED.custom_price, 
                           updated_at = CURRENT_TIMESTAMP`,
            [
              vendorId,
              customerUserId,
              item.productId,
              item.isEnabled,
              item.customPrice !== undefined ? item.customPrice : null,
            ]
          );
        }
      }

      // 9. Update registration request
      await client.query(
        `UPDATE customer.registration_requests 
         SET status = 'ACTIVATED', 
             activated_user_id = $1, 
             notes = COALESCE($2, notes),
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [customerUserId, notes?.trim() || null, requestId]
      );

      return {
        customerId: customerUserId,
        firstName: req.first_name,
        lastName: req.last_name,
        phone: req.phone,
        email: req.email,
        status: 'ACTIVATED',
        message: 'Customer account created and activated successfully with credentials.',
      };
    });
  }

  /**
   * Vendor: List registration requests for their store
   */
  public static async listVendorRequests(
    vendorUserId: string,
    options: {
      status?: 'PENDING' | 'OTP_VERIFIED' | 'ACTIVATED' | 'REJECTED';
      page?: number;
      limit?: number;
    }
  ): Promise<{
    requests: CustomerRegistrationRequestRecord[];
    total: number;
    page: number;
    limit: number;
  }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['vendor_id = $1'];
    const params: unknown[] = [vendorId];
    let paramIdx = 2;

    if (options.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(options.status);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM customer.registration_requests WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT id, vendor_id, initiated_by, first_name, last_name, phone, email, photo_url,
              address_line_1, city, state, postal_code, status, notes, activated_user_id,
              created_at, updated_at
       FROM customer.registration_requests
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    const requests: CustomerRegistrationRequestRecord[] = res.rows.map((row) => ({
      id: row.id,
      vendorId: row.vendor_id,
      initiatedBy: row.initiated_by,
      firstName: row.first_name,
      lastName: row.last_name,
      phone: row.phone,
      email: row.email,
      photoUrl: row.photo_url,
      addressLine1: row.address_line_1,
      city: row.city,
      state: row.state,
      postalCode: row.postal_code,
      status: row.status,
      notes: row.notes,
      activatedUserId: row.activated_user_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { requests, total, page, limit };
  }

  /**
   * Vendor: Reject customer registration request
   */
  public static async rejectRequest(
    vendorUserId: string,
    requestId: string,
    reason: string
  ): Promise<{ status: string; message: string }> {
    const vendorId = await this.getVendorByOwnerId(vendorUserId);

    const res = await query(
      `UPDATE customer.registration_requests
       SET status = 'REJECTED', notes = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND vendor_id = $3 AND status != 'ACTIVATED'
       RETURNING id`,
      [reason.trim(), requestId, vendorId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Registration request not found or cannot be rejected.', 404, 'REQUEST_NOT_FOUND');
    }

    return {
      status: 'REJECTED',
      message: 'Registration request rejected.',
    };
  }
}
