import { Router } from 'express';
import { VendorController } from '../modules/vendors/vendor.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  updateVendorProfileSchema,
  updateVendorStatusSchema,
  createVendorAddressSchema,
  updateVendorAddressSchema,
  addVendorStaffSchema,
  vendorQuerySchema,
} from '../modules/vendors/vendor.validation.js';

const router = Router();

// ==========================================
// 1. Logged-in Vendor Self-Service Routes
// (Must be defined BEFORE /:id to avoid collision)
// ==========================================
router.get(
  '/profile/me',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.getMyVendorProfile
);

router.put(
  '/profile/me',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateVendorProfileSchema),
  VendorController.updateMyVendorProfile
);

router.post(
  '/profile/me/addresses',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(createVendorAddressSchema),
  VendorController.addAddress
);

router.put(
  '/profile/me/addresses/:addressId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateVendorAddressSchema),
  VendorController.updateAddress
);

router.delete(
  '/profile/me/addresses/:addressId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.deleteAddress
);

router.get(
  '/profile/me/staff',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.getStaff
);

router.post(
  '/profile/me/staff',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(addVendorStaffSchema),
  VendorController.addStaff
);

router.delete(
  '/profile/me/staff/:userId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.removeStaff
);

// ==========================================
// 2. Public Marketplace Routes
// ==========================================
router.get('/', validate(vendorQuerySchema), VendorController.listVendors);
router.get('/:id', VendorController.getVendor);

// ==========================================
// 3. Admin Management Routes
// ==========================================
router.patch(
  '/:id/status',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(updateVendorStatusSchema),
  VendorController.updateVendorStatus
);

router.put(
  '/:id',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(updateVendorProfileSchema),
  VendorController.updateVendor
);

export default router;
