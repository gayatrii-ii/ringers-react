import { Request, Response, NextFunction } from 'express';
import { ReviewService } from './review.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class ReviewController {
  /**
   * POST /api/v1/reviews
   * Customer submits a review for a DELIVERED order
   */
  public static async createReview(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const { orderId, vendorRating, deliveryRating, vendorReview, deliveryReview } = req.body;
      const review = await ReviewService.createReview(req.user.userId, {
        orderId,
        vendorRating,
        deliveryRating,
        vendorReview,
        deliveryReview,
      });

      res.status(201).json({
        success: true,
        message: 'Review submitted successfully. Thank you for your feedback!',
        data: review,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reviews/vendor/:vendorId
   * Public: Get paginated reviews for a vendor with rating distribution
   */
  public static async getVendorReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.vendorId as string;
      const page = parseInt(String(req.query.page || '1'), 10);
      const limit = parseInt(String(req.query.limit || '20'), 10);

      const result = await ReviewService.getVendorReviews(vendorId, { page, limit });

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/reviews/my-reviews
   * Customer: Get all reviews written by the authenticated customer
   */
  public static async getMyReviews(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Authentication required', 401, 'UNAUTHORIZED');

      const reviews = await ReviewService.getCustomerReviews(req.user.userId);

      res.status(200).json({
        success: true,
        data: reviews,
      });
    } catch (error) {
      next(error);
    }
  }
}
