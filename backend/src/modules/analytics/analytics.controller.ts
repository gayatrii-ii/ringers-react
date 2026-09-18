import { Request, Response, NextFunction } from 'express';
import { AnalyticsService } from './analytics.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/admin/overview
   * Super Admin: GMV, revenue, user counts, wallet summary
   */
  public static async getAdminOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const result = await AnalyticsService.getAdminOverview(period, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/admin/vendors-leaderboard
   * Super Admin: Top vendors by sales revenue
   */
  public static async getVendorLeaderboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '10'), 10)));

      const result = await AnalyticsService.getVendorLeaderboard(period, limit);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/admin/delivery-performance
   * Super Admin: Fleet response times, completion rates and top riders
   */
  public static async getDeliveryPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const result = await AnalyticsService.getDeliveryPerformance(period, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/vendor/overview
   * Vendor: My store sales, revenue, top products, and ratings
   */
  public static async getVendorOverview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      // Get vendor_id from authenticated vendor's store
      const { query } = await import('../../config/database.js');
      const vendorRes = await query(
        `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [req.user.userId]
      );

      if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
        throw new AppError('No active vendor account found', 404, 'VENDOR_NOT_FOUND');
      }

      const vendorId: string = vendorRes.rows[0].id;
      const result = await AnalyticsService.getVendorOverview(vendorId, period, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/vendor/sales-trend
   * Vendor: Daily/weekly sales time series data
   */
  public static async getVendorSalesTrend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const { query } = await import('../../config/database.js');
      const vendorRes = await query(
        `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [req.user.userId]
      );

      if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
        throw new AppError('No active vendor account found', 404, 'VENDOR_NOT_FOUND');
      }

      const vendorId: string = vendorRes.rows[0].id;
      const result = await AnalyticsService.getVendorSalesTrend(vendorId, period, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/vendor/payment-breakdown
   * Vendor: Order count & revenue breakdown by payment method
   */
  public static async getVendorPaymentBreakdown(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;

      const { query } = await import('../../config/database.js');
      const vendorRes = await query(
        `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [req.user.userId]
      );

      if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
        throw new AppError('No active vendor account found', 404, 'VENDOR_NOT_FOUND');
      }

      const vendorId: string = vendorRes.rows[0].id;
      const result = await AnalyticsService.getVendorPaymentBreakdown(vendorId, period, startDate, endDate);

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
