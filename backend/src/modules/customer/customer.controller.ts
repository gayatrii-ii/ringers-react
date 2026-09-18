import { Request, Response, NextFunction } from 'express';
import { CustomerService } from './customer.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class CustomerController {
  /**
   * GET /api/v1/customers/profile/me
   */
  public static async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const profile = await CustomerService.getProfile(req.user.userId);
      res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/customers/profile/me
   */
  public static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const updated = await CustomerService.updateProfile(req.user.userId, req.body);
      res.status(200).json({
        success: true,
        message: 'Customer profile updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/addresses
   */
  public static async listAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const addresses = await CustomerService.listAddresses(req.user.userId);
      res.status(200).json({
        success: true,
        data: addresses,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/addresses/:id
   */
  public static async getAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const address = await CustomerService.getAddressById(req.user.userId, String(req.params.id));
      res.status(200).json({
        success: true,
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/customers/addresses
   */
  public static async createAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const address = await CustomerService.createAddress(req.user.userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Delivery address created successfully',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/customers/addresses/:id
   */
  public static async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const address = await CustomerService.updateAddress(req.user.userId, String(req.params.id), req.body);
      res.status(200).json({
        success: true,
        message: 'Delivery address updated successfully',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/customers/addresses/:id
   */
  public static async deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      await CustomerService.deleteAddress(req.user.userId, String(req.params.id));
      res.status(200).json({
        success: true,
        message: 'Delivery address removed successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/customers/addresses/:id/default
   */
  public static async setDefaultAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const address = await CustomerService.setDefaultAddress(req.user.userId, String(req.params.id));
      res.status(200).json({
        success: true,
        message: 'Default delivery address updated successfully',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/customers/profile/language
   */
  public static async updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const { language } = req.body;
      const result = await CustomerService.updateLanguage(req.user.userId, language);
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          preferredLanguage: result.preferredLanguage,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/customers/profile/stats
   */
  public static async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const stats = await CustomerService.getDashboardStats(req.user.userId);
      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/customers/profile/me
   */
  public static async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
      }

      const result = await CustomerService.deactivateAccount(req.user.userId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}
