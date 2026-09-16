import { Request, Response, NextFunction } from 'express';
import { CategoryService } from './category.service.js';

export class CategoryController {
  /**
   * GET /api/v1/categories (Public)
   */
  public static async listCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const flat = req.query.flat === 'true';
      const status = req.query.status as string | undefined;
      const categories = await CategoryService.listCategories(flat, status);
      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/categories/:idOrSlug (Public)
   */
  public static async getCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await CategoryService.getCategoryByIdOrSlug(req.params.idOrSlug as string);
      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/categories (Admin)
   */
  public static async createCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await CategoryService.createCategory(req.body);
      res.status(201).json({
        success: true,
        message: 'Category created successfully.',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/categories/:id (Admin)
   */
  public static async updateCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await CategoryService.updateCategory(req.params.id as string, req.body);
      res.status(200).json({
        success: true,
        message: 'Category updated successfully.',
        data: category,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/categories/:id (Admin)
   */
  public static async deleteCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await CategoryService.deleteCategory(req.params.id as string);
      res.status(200).json({
        success: true,
        message: 'Category deactivated successfully.',
      });
    } catch (error) {
      next(error);
    }
  }
}
