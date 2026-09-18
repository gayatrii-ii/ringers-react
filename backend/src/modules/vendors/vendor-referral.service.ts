import crypto from 'crypto';
import { query } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';

export interface VendorReferralSummary {
  referralCode: string;
  referralLink: string;
  metrics: {
    totalInvited: number;
    totalRegistered: number;
    totalActive: number;
    totalEarnings: number;
    pendingEarnings: number;
  };
}

export class VendorReferralService {
  /**
   * Helper: Get vendor store owned by user and ensure referral code exists
   */
  private static async getVendorAndReferralCode(userId: string): Promise<{ vendorId: string; referralCode: string }> {
    const res = await query<{ id: string; referral_code: string | null; business_code: string }>(
      `SELECT id, referral_code, business_code FROM vendor.vendors WHERE owner_user_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('Vendor store not found.', 404, 'VENDOR_NOT_FOUND');
    }

    const vendor = res.rows[0];

    if (!vendor.referral_code) {
      const generatedCode = `RNG-REF-${vendor.business_code || crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      await query(
        `UPDATE vendor.vendors SET referral_code = $1 WHERE id = $2`,
        [generatedCode, vendor.id]
      );
      return { vendorId: vendor.id, referralCode: generatedCode };
    }

    return { vendorId: vendor.id, referralCode: vendor.referral_code };
  }

  /**
   * Get vendor's referral dashboard profile & metrics
   */
  public static async getReferralProfile(vendorUserId: string): Promise<VendorReferralSummary> {
    const { vendorId, referralCode } = await this.getVendorAndReferralCode(vendorUserId);

    const metricsRes = await query<{
      total_invited: string;
      total_registered: string;
      total_active: string;
      total_paid: string;
      total_pending: string;
    }>(
      `SELECT 
         COUNT(*) as total_invited,
         COUNT(*) FILTER (WHERE status IN ('REGISTERED', 'APPROVED', 'ACTIVE')) as total_registered,
         COUNT(*) FILTER (WHERE status = 'ACTIVE') as total_active,
         COALESCE(SUM(reward_amount) FILTER (WHERE reward_status = 'PAID'), 0) as total_paid,
         COALESCE(SUM(reward_amount) FILTER (WHERE reward_status = 'PENDING'), 0) as total_pending
       FROM vendor.referrals
       WHERE referrer_vendor_id = $1`,
      [vendorId]
    );

    const m = metricsRes.rows[0] || {
      total_invited: '0',
      total_registered: '0',
      total_active: '0',
      total_paid: '0',
      total_pending: '0',
    };

    return {
      referralCode,
      referralLink: `https://ringers.app/join-vendor?ref=${referralCode}`,
      metrics: {
        totalInvited: parseInt(m.total_invited || '0', 10),
        totalRegistered: parseInt(m.total_registered || '0', 10),
        totalActive: parseInt(m.total_active || '0', 10),
        totalEarnings: parseFloat(m.total_paid || '0'),
        pendingEarnings: parseFloat(m.total_pending || '0'),
      },
    };
  }

  /**
   * Vendor invites a prospective vendor
   */
  public static async inviteVendor(
    vendorUserId: string,
    refereePhone?: string | null,
    refereeEmail?: string | null
  ): Promise<{ referralId: string; referralCode: string; message: string }> {
    const { vendorId, referralCode } = await this.getVendorAndReferralCode(vendorUserId);

    const insertRes = await query<{ id: string }>(
      `INSERT INTO vendor.referrals (
         referrer_vendor_id, referee_phone, referee_email, referral_code, status, reward_status
       ) VALUES ($1, $2, $3, $4, 'INVITED', 'PENDING')
       RETURNING id`,
      [vendorId, refereePhone?.trim() || null, refereeEmail?.trim().toLowerCase() || null, referralCode]
    );

    return {
      referralId: insertRes.rows[0]!.id,
      referralCode,
      message: 'Referral invitation recorded. Share your referral code or link with the vendor.',
    };
  }

  /**
   * Vendor: List all referrals sent by their store
   */
  public static async listVendorReferrals(
    vendorUserId: string,
    options: {
      status?: string;
      rewardStatus?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ referrals: any[]; total: number; page: number; limit: number }> {
    const { vendorId } = await this.getVendorAndReferralCode(vendorUserId);

    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['r.referrer_vendor_id = $1'];
    const params: unknown[] = [vendorId];
    let paramIdx = 2;

    if (options.status) {
      conditions.push(`r.status = $${paramIdx++}`);
      params.push(options.status);
    }

    if (options.rewardStatus) {
      conditions.push(`r.reward_status = $${paramIdx++}`);
      params.push(options.rewardStatus);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM vendor.referrals r WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT r.id, r.referral_code, r.referee_phone, r.referee_email,
              r.status, r.reward_status, r.reward_amount, r.reward_notes,
              r.created_at, r.updated_at,
              v.business_name as referred_vendor_name
       FROM vendor.referrals r
       LEFT JOIN vendor.vendors v ON v.id = r.referred_vendor_id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    return { referrals: res.rows, total, page, limit };
  }

  /**
   * Admin: List all referrals across the platform
   */
  public static async adminListReferrals(options: {
    status?: string;
    rewardStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<{ referrals: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (options.status) {
      conditions.push(`r.status = $${paramIdx++}`);
      params.push(options.status);
    }

    if (options.rewardStatus) {
      conditions.push(`r.reward_status = $${paramIdx++}`);
      params.push(options.rewardStatus);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM vendor.referrals r WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT r.id, r.referrer_vendor_id, rv.business_name as referrer_vendor_name,
              r.referral_code, r.referee_phone, r.referee_email,
              r.status, r.reward_status, r.reward_amount, r.reward_notes,
              r.created_at, r.updated_at,
              refv.business_name as referred_vendor_name
       FROM vendor.referrals r
       JOIN vendor.vendors rv ON rv.id = r.referrer_vendor_id
       LEFT JOIN vendor.vendors refv ON refv.id = r.referred_vendor_id
       WHERE ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
      [...params, limit, offset]
    );

    return { referrals: res.rows, total, page, limit };
  }

  /**
   * Admin: Update reward status and payout amount for a referral
   */
  public static async adminUpdateRewardStatus(
    referralId: string,
    rewardStatus: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED',
    rewardAmount?: number,
    rewardNotes?: string | null
  ): Promise<{ referralId: string; rewardStatus: string; message: string }> {
    const updates: string[] = ['reward_status = $1', 'updated_at = CURRENT_TIMESTAMP'];
    const params: unknown[] = [rewardStatus];
    let pIdx = 2;

    if (rewardAmount !== undefined) {
      updates.push(`reward_amount = $${pIdx++}`);
      params.push(rewardAmount);
    }

    if (rewardNotes !== undefined) {
      updates.push(`reward_notes = $${pIdx++}`);
      params.push(rewardNotes?.trim() || null);
    }

    params.push(referralId);

    const res = await query(
      `UPDATE vendor.referrals
       SET ${updates.join(', ')}
       WHERE id = $${pIdx}
       RETURNING id`,
      params
    );

    if (res.rows.length === 0) {
      throw new AppError('Referral record not found.', 404, 'NOT_FOUND');
    }

    return {
      referralId,
      rewardStatus,
      message: `Referral reward status updated to ${rewardStatus}.`,
    };
  }
}
