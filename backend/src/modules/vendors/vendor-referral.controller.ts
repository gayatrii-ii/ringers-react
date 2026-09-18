import { Request, Response, NextFunction } from 'express';
import { VendorReferralService } from './vendor-referral.service.js';

export class VendorReferralController {
  /**
   * Get vendor referral profile & metrics
   */
  public static async getReferralProfile(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await VendorReferralService.getReferralProfile(vendorUserId);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor invites prospective vendor
   */
  public static async inviteVendor(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const { refereePhone, refereeEmail } = req.body;
      const result = await VendorReferralService.inviteVendor(vendorUserId, refereePhone, refereeEmail);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor lists their sent referrals
   */
  public static async listVendorReferrals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await VendorReferralService.listVendorReferrals(vendorUserId, req.query as any);
      res.status(200).json({
        success: true,
        data: result.referrals,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin lists all referrals
   */
  public static async adminListReferrals(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await VendorReferralService.adminListReferrals(req.query as any);
      res.status(200).json({
        success: true,
        data: result.referrals,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin updates reward status
   */
  public static async adminUpdateRewardStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const referralId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const { rewardStatus, rewardAmount, rewardNotes } = req.body;
      const result = await VendorReferralService.adminUpdateRewardStatus(
        referralId,
        rewardStatus,
        rewardAmount,
        rewardNotes
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
