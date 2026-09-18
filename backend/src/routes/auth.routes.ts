import { Router } from 'express';
import { AuthController } from '../modules/auth/auth.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  loginSchema,
  vendorRegisterSchema,
  sendOtpSchema,
  verifyOtpSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from '../modules/auth/auth.validation.js';

const router = Router();

// Public Auth Endpoints
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/vendor/register', validate(vendorRegisterSchema), AuthController.registerVendor);
router.post('/send-otp', validate(sendOtpSchema), AuthController.sendOtp);
router.post('/verify-otp', validate(verifyOtpSchema), AuthController.verifyOtp);
router.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);
router.post('/refresh-token', validate(refreshTokenSchema), AuthController.refreshToken);
router.post('/logout', AuthController.logout);

// Protected Auth Endpoints
router.get('/me', authenticateToken, AuthController.getMe);
router.put('/change-password', authenticateToken, validate(changePasswordSchema), AuthController.changePassword);

// Role-Guard Demonstration / Verification Endpoints
router.get(
  '/admin-only',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN),
  (_req, res) => {
    res.json({ success: true, message: 'Welcome Super Administrator!' });
  }
);

router.get(
  '/vendor-only',
  authenticateToken,
  requireRoles(ROLES.VENDOR),
  (_req, res) => {
    res.json({ success: true, message: 'Welcome Vendor Partner!' });
  }
);

router.get(
  '/delivery-only',
  authenticateToken,
  requireRoles(ROLES.DELIVERY_BOY),
  (_req, res) => {
    res.json({ success: true, message: 'Welcome Delivery Partner!' });
  }
);

router.get(
  '/customer-only',
  authenticateToken,
  requireRoles(ROLES.CUSTOMER),
  (_req, res) => {
    res.json({ success: true, message: 'Welcome Valued Customer!' });
  }
);

export default router;
