import { Router } from 'express';
import { AdminController } from '../modules/admin/admin.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  publicVendorRequestSchema,
  publicDeliveryJobRequestSchema,
} from '../modules/admin/admin.validation.js';

const router = Router();

// ==========================================
// Public: Vendor Registration Request
// (No authentication - submitted by anyone seeking to become a vendor)
// ==========================================
router.post(
  '/vendor-request',
  validate(publicVendorRequestSchema),
  AdminController.submitVendorRequest
);

// ==========================================
// Public: Delivery Boy Job Application
// (No authentication - submitted by anyone seeking delivery partner work)
// ==========================================
router.post(
  '/delivery-job-request',
  validate(publicDeliveryJobRequestSchema),
  AdminController.submitDeliveryJobRequest
);

export default router;
