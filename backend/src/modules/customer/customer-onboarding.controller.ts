import { Request, Response, NextFunction } from 'express';
import { CustomerOnboardingService } from './customer-onboarding.service.js';

export class CustomerOnboardingController {
  /**
   * Flow B: Customer submits direct registration request (Public)
   */
  public static async submitDirectCustomerRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await CustomerOnboardingService.submitDirectCustomerRequest(req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Flow A: Vendor initiates customer registration request
   */
  public static async vendorInitiateCustomerRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await CustomerOnboardingService.vendorInitiateCustomerRequest(vendorUserId, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Flow A: Vendor verifies customer OTP
   */
  public static async vendorVerifyCustomerOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0]! : req.params.requestId!;
      const { otpCode } = req.body;
      const result = await CustomerOnboardingService.vendorVerifyCustomerOtp(vendorUserId, requestId, otpCode);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor: Activate customer account (Flow A after OTP or Flow B directly)
   */
  public static async activateCustomer(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0]! : req.params.requestId!;
      const { password, selectedProducts, notes } = req.body;
      const result = await CustomerOnboardingService.activateCustomer(
        vendorUserId,
        requestId,
        password,
        selectedProducts,
        notes
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor: List customer registration requests
   */
  public static async listVendorRequests(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const result = await CustomerOnboardingService.listVendorRequests(vendorUserId, req.query as any);
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
   * Vendor: Reject customer registration request
   */
  public static async rejectRequest(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorUserId = (req as any).user.userId;
      const requestId = Array.isArray(req.params.requestId) ? req.params.requestId[0]! : req.params.requestId!;
      const { reason } = req.body;
      const result = await CustomerOnboardingService.rejectRequest(vendorUserId, requestId, reason);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
