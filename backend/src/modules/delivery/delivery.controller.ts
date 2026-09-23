import { Request, Response, NextFunction } from 'express';
import { DeliveryService } from './delivery.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class DeliveryController {
  /**
   * GET /api/v1/delivery/profile/me
   */
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const profile = await DeliveryService.getProfile(req.user.userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/delivery/profile/me
   */
  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const updated = await DeliveryService.updateProfile(req.user.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Delivery partner vehicle profile updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/delivery/profile/language
   */
  public static async updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { preferredLanguage } = req.body;
      const result = await DeliveryService.updateLanguage(req.user.userId, preferredLanguage);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/delivery/profile/me
   */
  public static async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const result = await DeliveryService.deactivateRiderAccount(req.user.userId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }


  /**
   * PATCH /api/v1/delivery/duty-status
   */
  public static async updateDutyStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const result = await DeliveryService.updateDutyStatus(req.user.userId, req.body.status);
      res.status(200).json({
        success: true,
        message: result.message,
        data: { status: result.status },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/delivery/stats
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const stats = await DeliveryService.getStats(req.user.userId);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/delivery/admin/riders (Super Admin / Operations)
   */
  public static async adminListRiders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status, page, limit } = req.query as any;
      const result = await DeliveryService.adminListRiders({
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

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
   * PATCH /api/v1/delivery/admin/riders/:id/status (Super Admin)
   */
  public static async adminSetRiderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await DeliveryService.adminSetRiderStatus(String(id), status);

      res.status(200).json({
        success: true,
        message: result.message,
        data: { status: result.status },
      });
    } catch (error) {
      next(error);
    }
  }
}
