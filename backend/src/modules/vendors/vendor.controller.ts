import { Request, Response, NextFunction } from 'express';
import { VendorService } from './vendor.service.js';
import { ROLES } from '../../constants/roles.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class VendorController {
  /**
   * Helper to resolve target vendor ID based on user roles and request parameters.
   * If caller is VENDOR, resolves the store owned by req.user.userId.
   * If caller is SUPER_ADMIN/ADMIN, resolves from route param or fallback to owner.
   */
  public static async resolveVendorIdForUser(req: Request): Promise<string> {
    if (!req.user) {
      throw new AppError('Authentication required.', 401, 'UNAUTHORIZED');
    }

    const isAdmin = req.user.roles.includes(ROLES.SUPER_ADMIN) || req.user.roles.includes(ROLES.ADMIN);

    if (req.params.id && isAdmin) {
      return req.params.id as string;
    }

    // Default to resolving store owned by caller
    const vendor = await VendorService.getVendorByOwnerUserId(req.user.userId);
    return vendor.id;
  }

  /**
   * GET /api/v1/vendors (Public with optional filters)
   */
  public static async listVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const isAdmin = req.user?.roles.some((r) => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(r as any)) || false;
      const result = await VendorService.listVendors(req.query as any, isAdmin);
      res.status(200).json({
        success: true,
        data: result.vendors,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/vendors/:id (Public store details)
   */
  public static async getVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await VendorService.getVendorById(req.params.id as string);
      res.status(200).json({
        success: true,
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/vendors/profile/me (Logged in vendor)
   */
  public static async getMyVendorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await VendorService.getVendorByOwnerUserId(req.user!.userId);
      res.status(200).json({
        success: true,
        data: vendor,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/vendors/profile/me (Update own store)
   */
  public static async updateMyVendorProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendor = await VendorService.getVendorByOwnerUserId(req.user!.userId);
      const updated = await VendorService.updateVendorProfile(vendor.id, req.body);
      res.status(200).json({
        success: true,
        message: 'Vendor profile updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/vendors/:id (Admin update store)
   */
  public static async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const updated = await VendorService.updateVendorProfile(vendorId, req.body);
      res.status(200).json({
        success: true,
        message: 'Vendor updated successfully.',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/vendors/:id/status (Admin approval / status toggle)
   */
  public static async updateVendorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updated = await VendorService.updateVendorStatus(req.params.id as string, req.body.status);
      res.status(200).json({
        success: true,
        message: `Vendor status updated to ${req.body.status}.`,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/vendors/profile/me/addresses (Add address to store)
   */
  public static async addAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const address = await VendorService.addVendorAddress(vendorId, req.body);
      res.status(201).json({
        success: true,
        message: 'Storefront address added successfully.',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/vendors/profile/me/addresses/:addressId (Update address)
   */
  public static async updateAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const address = await VendorService.updateVendorAddress(req.params.addressId as string, vendorId, req.body);
      res.status(200).json({
        success: true,
        message: 'Storefront address updated successfully.',
        data: address,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/vendors/profile/me/addresses/:addressId (Delete address)
   */
  public static async deleteAddress(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      await VendorService.deleteVendorAddress(req.params.addressId as string, vendorId);
      res.status(200).json({
        success: true,
        message: 'Storefront address deleted successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/vendors/profile/me/staff
   */
  public static async getStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const staff = await VendorService.getVendorStaff(vendorId);
      res.status(200).json({
        success: true,
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/vendors/profile/me/staff
   */
  public static async addStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const staff = await VendorService.addVendorStaff(vendorId, req.body.userId, req.body.designation);
      res.status(201).json({
        success: true,
        message: 'Staff member assigned successfully.',
        data: staff,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/vendors/profile/me/staff/:userId
   */
  public static async removeStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      await VendorService.removeVendorStaff(vendorId, req.params.userId as string);
      res.status(200).json({
        success: true,
        message: 'Staff member removed successfully.',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/vendors/profile/me/payment-settings
   */
  public static async getPaymentSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const settings = await VendorService.getPaymentSettings(vendorId);
      res.status(200).json({
        success: true,
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/vendors/profile/me/payment-settings
   */
  public static async updatePaymentSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const { upiId, upiQrUrl, upiPayUrl } = req.body;
      const settings = await VendorService.updatePaymentSettings(vendorId, { upiId, upiQrUrl, upiPayUrl });
      res.status(200).json({
        success: true,
        message: 'Payment settings updated successfully.',
        data: settings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/v1/vendors/profile/me/language
   */
  public static async updateLanguage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = await VendorController.resolveVendorIdForUser(req);
      const { preferredLanguage } = req.body;
      const result = await VendorService.updateLanguage(vendorId, preferredLanguage);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/vendors/profile/me
   */
  public static async deactivateAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      const result = await VendorService.deactivateVendorAccount(req.user.userId);
      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      next(error);
    }
  }
}

