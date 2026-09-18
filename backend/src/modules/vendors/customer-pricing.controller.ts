import { Request, Response, NextFunction } from 'express';
import { CustomerPricingService } from './customer-pricing.service.js';

function getParam(param: string | string[] | undefined): string {
  return Array.isArray(param) ? param[0]! : param!;
}

export class CustomerPricingController {
  /**
   * List customer products and pricing
   */
  public static async listCustomerProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorId = getParam(req.params.vendorId);
      const customerId = getParam(req.params.customerId);
      const user = (req as any).user;
      const result = await CustomerPricingService.listCustomerProducts(
        vendorId,
        customerId,
        user.userId,
        user.roles
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Configure customer products and custom prices
   */
  public static async configureCustomerProducts(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorId = getParam(req.params.vendorId);
      const customerId = getParam(req.params.customerId);
      const user = (req as any).user;
      const { products } = req.body;
      const result = await CustomerPricingService.configureCustomerProducts(
        vendorId,
        customerId,
        user.userId,
        user.roles,
        products
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Toggle vendor catalog restriction mode
   */
  public static async toggleCatalogRestriction(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const vendorId = getParam(req.params.vendorId);
      const user = (req as any).user;
      const { restrictCustomerCatalog } = req.body;
      const result = await CustomerPricingService.toggleCatalogRestriction(
        vendorId,
        user.userId,
        user.roles,
        restrictCustomerCatalog
      );
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
