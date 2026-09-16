import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class AdminController {
  public static async generateKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      const { expiryDays, customCode } = req.body;
      const key = await AdminService.generatePrivateKey(req.user.userId, expiryDays, customCode);

      res.status(201).json({
        success: true,
        message: 'Private registration key generated successfully',
        data: key,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async listKeys(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, search, page, limit } = req.query as any;
      const result = await AdminService.listKeys({ status, search, page, limit });

      res.status(200).json({
        success: true,
        data: result.keys,
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

  public static async revokeKey(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      const { id } = req.params;
      const key = await AdminService.revokeKey(String(id), req.user.userId);

      res.status(200).json({
        success: true,
        message: 'Private key revoked successfully',
        data: key,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async listVendorRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page, limit } = req.query as any;
      const result = await AdminService.listVendorRequests({ status, page, limit });

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

  public static async reviewVendorRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      const { id } = req.params;
      const { status, rejectionReason, expiryDays } = req.body;

      const result = await AdminService.reviewVendorRequest(
        String(id),
        req.user.userId,
        status,
        rejectionReason,
        expiryDays
      );

      res.status(200).json({
        success: true,
        message: `Vendor request ${status.toLowerCase()} successfully`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async listDeliveryJobRequests(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page, limit } = req.query as any;
      const result = await AdminService.listDeliveryJobRequests({ status, page, limit });

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

  public static async assignDeliveryJobRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      const { id } = req.params;
      const { vendorId, notes } = req.body;

      const result = await AdminService.assignDeliveryBoyToVendor(String(id), req.user.userId, vendorId, notes);

      res.status(200).json({
        success: true,
        message: 'Delivery rider application connected to vendor successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  public static async getPlatformMetrics(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const metrics = await AdminService.getPlatformMetrics();

      res.status(200).json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      next(error);
    }
  }

  // Public submission handlers
  public static async submitVendorRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminService.createVendorRequest(req.body);

      res.status(201).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  }

  public static async submitDeliveryJobRequest(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AdminService.createDeliveryJobRequest(req.body);

      res.status(201).json({
        success: true,
        message: result.message,
        data: { id: result.id },
      });
    } catch (error) {
      next(error);
    }
  }
}
