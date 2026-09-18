import { Router } from 'express';
import { CustomerController } from '../modules/customer/customer.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  updateCustomerProfileSchema,
  createCustomerAddressSchema,
  updateCustomerAddressSchema,
  addressIdParamSchema,
} from '../modules/customer/customer.validation.js';
import { CustomerOnboardingController } from '../modules/customer/customer-onboarding.controller.js';
import { customerDirectRegistrationSchema } from '../modules/customer/customer-onboarding.validation.js';

const router = Router();

// ==========================================
// Public: Customer Direct Registration Request (Flow B)
// Unauthenticated prospective customer submits request to selected vendor
// ==========================================
router.post(
  '/registration-requests',
  validate(customerDirectRegistrationSchema),
  CustomerOnboardingController.submitDirectCustomerRequest
);

// All subsequent customer routes require authentication and CUSTOMER or SUPER_ADMIN role
router.use(authenticateToken);
router.use(requireRoles(ROLES.CUSTOMER, ROLES.SUPER_ADMIN));

// ==========================================
// 1. Customer Profile
// ==========================================
router.get('/profile/me', CustomerController.getProfile);
router.put('/profile/me', validate(updateCustomerProfileSchema), CustomerController.updateProfile);

// ==========================================
// 2. Saved Delivery Addresses
// ==========================================
router.get('/addresses', CustomerController.listAddresses);
router.post('/addresses', validate(createCustomerAddressSchema), CustomerController.createAddress);

router.get('/addresses/:id', validate(addressIdParamSchema), CustomerController.getAddress);
router.put(
  '/addresses/:id',
  validate(addressIdParamSchema),
  validate(updateCustomerAddressSchema),
  CustomerController.updateAddress
);
router.delete('/addresses/:id', validate(addressIdParamSchema), CustomerController.deleteAddress);

router.patch(
  '/addresses/:id/default',
  validate(addressIdParamSchema),
  CustomerController.setDefaultAddress
);

export default router;
