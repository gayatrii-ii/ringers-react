import { Router } from 'express';
import { ProductController } from '../modules/products/product.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  createProductVariantSchema,
  updateProductVariantSchema,
  addProductImageSchema,
  productQuerySchema,
} from '../modules/products/product.validation.js';

const router = Router();

// ==========================================
// 1. Public Browsing Routes
// ==========================================
router.get('/', validate(productQuerySchema), ProductController.listProducts);
router.get('/vendor/:vendorId', ProductController.getProductsByVendor);
router.get('/:idOrSlug', ProductController.getProduct);

// ==========================================
// 2. Protected Vendor / Admin Catalog Routes
// ==========================================
router.post(
  '/',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(createProductSchema),
  ProductController.createProduct
);

router.put(
  '/:id',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateProductSchema),
  ProductController.updateProduct
);

router.patch(
  '/:id/status',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateProductStatusSchema),
  ProductController.updateProductStatus
);

router.delete(
  '/:id',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  ProductController.deleteProduct
);

// ==========================================
// 3. Variant Management
// ==========================================
router.post(
  '/:id/variants',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(createProductVariantSchema),
  ProductController.addVariant
);

router.put(
  '/:id/variants/:variantId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateProductVariantSchema),
  ProductController.updateVariant
);

router.delete(
  '/:id/variants/:variantId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  ProductController.deleteVariant
);

// ==========================================
// 4. Image Asset Management
// ==========================================
router.post(
  '/:id/images',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(addProductImageSchema),
  ProductController.addImage
);

router.delete(
  '/:id/images/:imageId',
  authenticateToken,
  requireRoles(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  ProductController.deleteImage
);

export default router;
