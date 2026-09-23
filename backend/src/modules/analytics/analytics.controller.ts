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

  /**
   * GET /api/v1/analytics/vendor/product-sales
   * Vendor: Product-wise sales breakdown report
   */
  public static async getVendorProductSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(String(req.query.page || '1'), 10);
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || '20'), 10);
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
      const result = await AnalyticsService.getVendorProductSalesReport(
        vendorId,
        period,
        page,
        limit,
        startDate,
        endDate
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/vendor/customer-sales
   * Vendor: Customer-wise spend & order frequency report
   */
  public static async getVendorCustomerSales(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(String(req.query.page || '1'), 10);
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || '20'), 10);
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
      const result = await AnalyticsService.getVendorCustomerSalesReport(
        vendorId,
        period,
        page,
        limit,
        startDate,
        endDate
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/vendor/rider-performance
   * Vendor: Fleet rider delivery completion & speed report
   */
  public static async getVendorRiderPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const period = String(req.query.period || 'month');
      const page = typeof req.query.page === 'number' ? req.query.page : parseInt(String(req.query.page || '1'), 10);
      const limit = typeof req.query.limit === 'number' ? req.query.limit : parseInt(String(req.query.limit || '20'), 10);
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
      const result = await AnalyticsService.getVendorRiderPerformanceReport(
        vendorId,
        period,
        page,
        limit,
        startDate,
        endDate
      );

      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/admin/vendors/:vendorId/overview
   * Super Admin: Vendor 360° overview
   */
  public static async getVendor360Overview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.vendorId as string;
      const result = await AnalyticsService.getVendor360Overview(vendorId);
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/admin/vendor-sales-report
   * Super Admin: Vendor-wise sales performance report
   */
  public static async getAdminSalesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = String(req.query.period || 'month');
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const vendorId = req.query.vendorId ? String(req.query.vendorId) : undefined;

      const result = await AnalyticsService.getAdminSalesReport(
        period,
        startDate,
        endDate,
        vendorId,
        page,
        limit
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/analytics/admin/platform-orders-report
   * Super Admin: Platform orders report
   */
  public static async getAdminOrdersReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const period = String(req.query.period || 'month');
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const status = req.query.status ? String(req.query.status) : undefined;
      const vendorId = req.query.vendorId ? String(req.query.vendorId) : undefined;

      const result = await AnalyticsService.getAdminOrdersReport(
        period,
        startDate,
        endDate,
        status,
        vendorId,
        page,
        limit
      );
      res.status(200).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}

