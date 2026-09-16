import { Request, Response, NextFunction } from 'express';
import { ProductService } from './product.service.js';
import { VendorService } from '../vendors/vendor.service.js';
import { ROLES } from '../../constants/roles.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class ProductController {
  /**
   * Helper to resolve vendor ID for the current authenticated user
   */
  private static async resolveVendorId(req: Request): Promise<{ vendorId: string; isAdmin: boolean }> {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const isAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN) || req.user.roles.includes(ROLES.ADMIN);

    if (isAdmin && (req.body.vendorId || req.query.vendorId)) {
      return {
        vendorId: ((req.body.vendorId || req.query.vendorId) as string),
        isAdmin: true,
      };
    }

    const vendor = await VendorService.getVendorByOwnerUserId(req.user.userId);
    return {
      vendorId: vendor.id,
      isAdmin,
    };
  }

  /**
   * GET /api/v1/products (Public)
   */
  public static async listProducts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await ProductService.listProducts(req.query as any);
      res.status(200).json({
        success: true,
        data: result.products,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/products/:idOrSlug (Public)
   */
  public static async getProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const product = await ProductService.getProductByIdOrSlug(req.params.idOrSlug as string);
      res.status(200).json({
        success: true,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/products/vendor/:vendorId (Public)
   */
  public static async getProductsByVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = { ...(req.query as any), vendorId: req.params.vendorId as string };
      const result = await ProductService.listProducts(query);
      res.status(200).json({
        success: true,
        data: result.products,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/products (Vendor or Admin)
   */
  public static async createProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId } = await ProductController.resolveVendorId(req);
      const product = await ProductService.createProduct(vendorId, req.body);
      res.status(201).json({
        success: true,
        message: 'Product created successfully.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/products/:id (Vendor or Admin)
   */
  public static async updateProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      const product = await ProductService.updateProduct(req.params.id as string, vendorId, req.body, isAdmin);
      res.status(200).json({
        success: true,
        message: 'Product updated successfully.',
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/products/:id/status (Vendor or Admin)
   */
  public static async updateProductStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      const product = await ProductService.updateProductStatus(req.params.id as string, vendorId, req.body.status, isAdmin);
      res.status(200).json({
        success: true,
        message: `Product status changed to ${req.body.status}.`,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/products/:id (Vendor or Admin)
   */
  public static async deleteProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      await ProductService.deleteProduct(req.params.id as string, vendorId, isAdmin);
      res.status(200).json({
        success: true,
        message: 'Product deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/products/:id/variants (Vendor or Admin)
   */
  public static async addVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      const variant = await ProductService.addVariant(req.params.id as string, vendorId, req.body, isAdmin);
      res.status(201).json({
        success: true,
        message: 'Product variant added successfully.',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/products/:id/variants/:variantId (Vendor or Admin)
   */
  public static async updateVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      const variant = await ProductService.updateVariant(
        req.params.variantId as string,
        req.params.id as string,
        vendorId,
        req.body,
        isAdmin
      );
      res.status(200).json({
        success: true,
        message: 'Product variant updated successfully.',
        data: variant,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/products/:id/variants/:variantId (Vendor or Admin)
   */
  public static async deleteVariant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      await ProductService.deleteVariant(req.params.variantId as string, req.params.id as string, vendorId, isAdmin);
      res.status(200).json({
        success: true,
        message: 'Product variant deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/products/:id/images (Vendor or Admin)
   */
  public static async addImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      const image = await ProductService.addImage(req.params.id as string, vendorId, req.body, isAdmin);
      res.status(201).json({
        success: true,
        message: 'Product image added successfully.',
        data: image,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/products/:id/images/:imageId (Vendor or Admin)
   */
  public static async deleteImage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { vendorId, isAdmin } = await ProductController.resolveVendorId(req);
      await ProductService.deleteImage(req.params.imageId as string, req.params.id as string, vendorId, isAdmin);
      res.status(200).json({
        success: true,
        message: 'Product image deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
