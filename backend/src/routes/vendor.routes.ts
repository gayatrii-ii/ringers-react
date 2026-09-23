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
  updateVendorPaymentSettingsSchema,
  updateVendorLanguageSchema,
} from '../modules/vendors/vendor.validation.js';
import { CustomerOnboardingController } from '../modules/customer/customer-onboarding.controller.js';
import {
  vendorInitiateCustomerSchema,
  verifyCustomerOtpSchema,
  activateCustomerAccountSchema,
  listRegistrationRequestsSchema,
  rejectRegistrationRequestSchema,
} from '../modules/customer/customer-onboarding.validation.js';
import { CustomerPricingController } from '../modules/vendors/customer-pricing.controller.js';
import {
  customerPricingParamSchema,
  updateCustomerProductsSchema,
  toggleCatalogRestrictionSchema,
} from '../modules/vendors/customer-pricing.validation.js';
import { VendorDeliveryOnboardingController } from '../modules/vendors/vendor-delivery-onboarding.controller.js';
import {
  listVendorDeliveryRequestsSchema,
  activateDeliveryBoySchema,
  listVendorDeliveryBoysSchema,
  updateVendorRiderStatusSchema,
  createDirectDeliveryBoySchema,
  vendorResetRiderPasswordSchema,
} from '../modules/vendors/vendor-delivery-onboarding.validation.js';
import { VendorReferralController } from '../modules/vendors/vendor-referral.controller.js';
import {
  inviteVendorSchema,
  listReferralsSchema,
} from '../modules/vendors/vendor-referral.validation.js';

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

router.patch(
  '/profile/me/language',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateVendorLanguageSchema),
  VendorController.updateLanguage
);

router.delete(
  '/profile/me',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.deactivateAccount
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
// UPI Payment Settings
// ==========================================
router.get(
  '/profile/me/payment-settings',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorController.getPaymentSettings
);

router.put(
  '/profile/me/payment-settings',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateVendorPaymentSettingsSchema),
  VendorController.updatePaymentSettings
);

// ==========================================
// 1b. Customer Onboarding & Registration (Flow A & Flow B)
// ==========================================
router.post(
  '/customers/register',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorInitiateCustomerSchema),
  CustomerOnboardingController.vendorInitiateCustomerRequest
);

router.post(
  '/customers/:requestId/verify-otp',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(verifyCustomerOtpSchema),
  CustomerOnboardingController.vendorVerifyCustomerOtp
);

router.post(
  '/customers/:requestId/activate',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(activateCustomerAccountSchema),
  CustomerOnboardingController.activateCustomer
);

router.get(
  '/customers/registration-requests',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(listRegistrationRequestsSchema),
  CustomerOnboardingController.listVendorRequests
);

router.patch(
  '/customers/registration-requests/:requestId/reject',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(rejectRegistrationRequestSchema),
  CustomerOnboardingController.rejectRequest
);

// ==========================================
// 1c. Connected Delivery Partner Onboarding
// ==========================================
router.get(
  '/delivery-boys/job-requests',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(listVendorDeliveryRequestsSchema),
  VendorDeliveryOnboardingController.listConnectedRequests
);

router.post(
  '/delivery-boys/activate',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(activateDeliveryBoySchema),
  VendorDeliveryOnboardingController.activateDeliveryBoy
);

router.get(
  '/delivery-boys',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(listVendorDeliveryBoysSchema),
  VendorDeliveryOnboardingController.listVendorDeliveryBoys
);

router.patch(
  '/delivery-boys/:riderId/status',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateVendorRiderStatusSchema),
  VendorDeliveryOnboardingController.updateVendorRiderStatus
);

// Flow A: Direct Delivery Boy Account Creation
router.post(
  '/delivery-boys',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(createDirectDeliveryBoySchema),
  VendorDeliveryOnboardingController.createDirectDeliveryBoy
);

// Vendor resets password for delivery boy
router.patch(
  '/delivery-boys/:riderId/reset-password',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(vendorResetRiderPasswordSchema),
  VendorDeliveryOnboardingController.resetRiderPassword
);


// ==========================================
// 1d. Vendor Referral Program
// ==========================================
router.get(
  '/referral',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  VendorReferralController.getReferralProfile
);

router.post(
  '/referrals/invite',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(inviteVendorSchema),
  VendorReferralController.inviteVendor
);

router.get(
  '/referrals',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(listReferralsSchema),
  VendorReferralController.listVendorReferrals
);

// ==========================================
// 1e. Customer-Specific Products & Pricing Configuration
// ==========================================
router.get(
  '/:vendorId/customers/:customerId/products',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(customerPricingParamSchema),
  CustomerPricingController.listCustomerProducts
);

router.put(
  '/:vendorId/customers/:customerId/products',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateCustomerProductsSchema),
  CustomerPricingController.configureCustomerProducts
);

router.patch(
  '/:vendorId/catalog-restriction',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(toggleCatalogRestrictionSchema),
  CustomerPricingController.toggleCatalogRestriction
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
