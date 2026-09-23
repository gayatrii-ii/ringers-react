import { Router } from 'express';
import { AdminController } from '../modules/admin/admin.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import {
  publicVendorRequestSchema,
  publicDeliveryJobRequestSchema,
  applicantRequestStatusQuerySchema,
} from '../modules/admin/admin.validation.js';
import { PolicyController } from '../modules/public/policy.controller.js';

const router = Router();

// ==========================================
// Public: Vendor Registration Request
// ==========================================
router.post(
  '/vendor-request',
  validate(publicVendorRequestSchema),
  AdminController.submitVendorRequest
);

router.get(
  '/vendor-request/status',
  validate(applicantRequestStatusQuerySchema),
  AdminController.getPublicVendorRequestStatus
);

// ==========================================
// Public: Delivery Boy Job Application
// ==========================================
router.post(
  '/delivery-job-request',
  validate(publicDeliveryJobRequestSchema),
  AdminController.submitDeliveryJobRequest
);

router.get(
  '/delivery-job-request/status',
  validate(applicantRequestStatusQuerySchema),
  AdminController.getPublicDeliveryJobRequestStatus
);

// ==========================================
// Public: Tri-Lingual Legal Policies (EN / HI / MR)
// ==========================================
router.get(
  '/policies/:policyType',
  PolicyController.getPolicy
);

export default router;

