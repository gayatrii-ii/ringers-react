import { Request, Response, NextFunction } from 'express';
import { VendorDeliveryOnboardingService } from './vendor-delivery-onboarding.service.js';

export class VendorDeliveryOnboardingController {
  /**
   * Vendor: List connected delivery partner job requests
   */
  public static async listConnectedRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await VendorDeliveryOnboardingService.listConnectedRequests(vendorUserId, req.query as any);
      res.status(200).json({
        success: true,
        data: result.requests,
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
   * Vendor: Activate delivery partner account
   */
  public static async activateDeliveryBoy(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const { jobRequestId, password } = req.body;
      const result = await VendorDeliveryOnboardingService.activateDeliveryBoy(
        vendorUserId,
        jobRequestId,
        password
      );
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor: List all active and connected delivery partners in vendor's fleet
   */
  public static async listVendorDeliveryBoys(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await VendorDeliveryOnboardingService.listVendorDeliveryBoys(
        vendorUserId,
        req.query as any
      );
      res.status(200).json({
        success: true,
        data: result.riders,
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
   * Vendor: Update rider status (ACTIVE / INACTIVE / SUSPENDED)
   */
  public static async updateVendorRiderStatus(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const { riderId } = req.params;
      const { status } = req.body;
      const result = await VendorDeliveryOnboardingService.updateVendorRiderStatus(
        vendorUserId,
        String(riderId),
        status
      );
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          riderId: result.riderId,
          status: result.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
