import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { RoleCode } from '../../constants/roles.js';

export class OrderController {
  /**
   * POST /api/v1/orders/calculate (Cart & Pricing Calculation)
   */
  public static async calculateOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { vendorId, addressId, items } = req.body;
      const result = await OrderService.calculateOrder(req.user.userId, vendorId, addressId, items);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/orders (Place Order with Immutable Snapshots)
   */
  public static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { vendorId, addressId, items, customerNotes } = req.body;
      const order = await OrderService.createOrder(req.user.userId, {
        vendorId,
        addressId,
        items,
        customerNotes,
      });

      res.status(201).json({
        success: true,
        message: 'Order placed successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/orders/:id/status (Order State Machine Transition)
   */
  public static async updateOrderStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { id } = req.params;
      const { status, reason } = req.body;

      const updatedOrder = await OrderService.updateOrderStatus(
        String(id),
        status,
        req.user.userId,
        req.user.roles as RoleCode[],
        reason
      );

      res.status(200).json({
        success: true,
        message: `Order transitioned to ${status} successfully`,
        data: updatedOrder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/orders/:id/cancel (Customer / Vendor Cancel Order)
   */
  public static async cancelOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { id } = req.params;
      const { reason } = req.body;

      const cancelledOrder = await OrderService.cancelOrder(
        String(id),
        req.user.userId,
        req.user.roles as RoleCode[],
        reason
      );

      res.status(200).json({
        success: true,
        message: 'Order cancelled successfully',
        data: cancelledOrder,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/orders/:id (Get Order Details by ID)
   */
  public static async getOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { id } = req.params;
      const order = await OrderService.getOrderById(String(id), req.user.userId, req.user.roles as RoleCode[]);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/orders/my-orders (Customer Past & Active Orders)
   */
  public static async listCustomerOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { status, page, limit } = req.query as any;
      const result = await OrderService.listCustomerOrders(req.user.userId, {
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.orders,
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
   * GET /api/v1/orders/vendor/live (Vendor Live Orders Desk)
   */
  public static async listVendorOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { status, page, limit } = req.query as any;
      const result = await OrderService.listVendorOrders(req.user.userId, {
        status,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.orders,
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
   * GET /api/v1/orders/admin/all (Super Admin Global Order Monitor)
   */
  public static async listAdminOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { status, paymentStatus, deliveryStatus, vendorId, customerId, startDate, endDate, page, limit } =
        req.query as any;

      const result = await OrderService.listAdminOrders({
        status,
        paymentStatus,
        deliveryStatus,
        vendorId,
        customerId,
        startDate,
        endDate,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });

      res.status(200).json({
        success: true,
        data: result.orders,
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
}
