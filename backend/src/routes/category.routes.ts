import { Router } from 'express';
import { CategoryController } from '../modules/products/category.controller.js';
import { validate } from '../middlewares/validate.middleware.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryQuerySchema,
} from '../modules/products/category.validation.js';

const router = Router();

// Public Routes
router.get('/', validate(categoryQuerySchema), CategoryController.listCategories);
router.get('/:idOrSlug', CategoryController.getCategory);

// Protected Admin Routes
router.post(
  '/',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(createCategorySchema),
  CategoryController.createCategory
);

router.put(
  '/:id',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(updateCategorySchema),
  CategoryController.updateCategory
);

router.delete(
  '/:id',
  authenticateToken,
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  CategoryController.deleteCategory
);

export default router;
