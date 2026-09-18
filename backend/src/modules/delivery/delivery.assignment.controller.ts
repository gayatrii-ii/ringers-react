import { Request, Response, NextFunction } from 'express';
import { DeliveryAssignmentService } from './delivery.assignment.service.js';

function getParamId(req: Request): string {
  return Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
}

export class DeliveryAssignmentController {
  /**
   * Vendor: Assign Rider to Order
   */
  public static async assignRider(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = getParamId(req);
      const { riderId } = req.body;
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.assignRiderToOrder(
        orderId,
        user.userId,
        user.roles,
        riderId
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
   * Rider: Accept Assignment
   */
  public static async acceptAssignment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const assignmentId = getParamId(req);
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.acceptAssignment(
        assignmentId,
        user.userId
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
   * Rider: Reject Assignment
   */
  public static async rejectAssignment(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const assignmentId = getParamId(req);
      const { reason } = req.body;
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.rejectAssignment(
        assignmentId,
        user.userId,
        reason
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
   * Rider: Mark Picked Up
   */
  public static async markPickedUp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const assignmentId = getParamId(req);
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.markPickedUp(
        assignmentId,
        user.userId
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
   * Rider: Complete Delivery with Customer OTP (Path A)
   */
  public static async completeDeliveryWithOtp(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = getParamId(req);
      const { otpCode } = req.body;
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.completeDeliveryWithOtp(
        orderId,
        user.userId,
        otpCode
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
   * Customer: Directly Confirm Delivery Receipt (Path B)
   */
  public static async customerConfirmDelivery(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = getParamId(req);
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.customerConfirmDelivery(
        orderId,
        user.userId
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
   * Rider: Report Delivery Failure
   */
  public static async reportDeliveryFailure(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const assignmentId = getParamId(req);
      const { reasonCode, notes } = req.body;
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.reportDeliveryFailure(
        assignmentId,
        user.userId,
        reasonCode,
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
   * Rider: Ingest GPS Location Beacon
   */
  public static async recordLocation(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      const { latitude, longitude, accuracy } = req.body;

      const result = await DeliveryAssignmentService.recordRiderLocation(
        user.userId,
        latitude,
        longitude,
        accuracy
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
   * Order Tracking: Real-Time Coordinates & Delivery Details
   */
  public static async getOrderTracking(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const orderId = getParamId(req);
      const user = (req as any).user;

      const result = await DeliveryAssignmentService.getOrderTracking(
        orderId,
        user.userId,
        user.roles
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
   * Rider: List Assigned Orders & Delivery History
   */
  public static async listMyAssignments(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await DeliveryAssignmentService.listRiderAssignments(
        user.userId,
        req.query as any
      );

      res.status(200).json({
        success: true,
        data: result.assignments,
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
