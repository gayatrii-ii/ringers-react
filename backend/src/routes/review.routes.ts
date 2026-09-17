import { Router } from 'express';
import { ReviewController } from '../modules/reviews/review.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import { createReviewSchema, vendorReviewQuerySchema } from '../modules/reviews/review.validation.js';

const router = Router();

// 1. Submit a review (Customer only, for DELIVERED orders)
router.post(
  '/',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  validate(createReviewSchema),
  ReviewController.createReview
);

// 2. Get reviews for a specific vendor (public — no auth required)
router.get(
  '/vendor/:vendorId',
  validate(vendorReviewQuerySchema),
  ReviewController.getVendorReviews
);

// 3. Get my own reviews (Customer)
router.get(
  '/my-reviews',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN),
  ReviewController.getMyReviews
);

export default router;
