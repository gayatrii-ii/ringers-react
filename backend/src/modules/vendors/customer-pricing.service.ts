import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES, RoleCode } from '../../constants/roles.js';

export interface CustomerProductConfig {
  productId: string;
  name: string;
  sku: string;
  catalogRegularPrice: number;
  catalogDiscountPrice: number | null;
  isActive: boolean;
  isEnabled: boolean;
  customPrice: number | null;
  effectivePrice: number;
}

export class CustomerPricingService {
  /**
   * Helper: Ensure requester is vendor owner or super admin
   */
  private static async verifyVendorAccess(
    vendorId: string,
    userId: string,
    userRoles: RoleCode[]
  ): Promise<void> {
    if (userRoles.includes(ROLES.SUPER_ADMIN)) {
      return;
    }

    const res = await query<{ owner_user_id: string }>(
      `SELECT owner_user_id FROM vendor.vendors WHERE id = $1 AND deleted_at IS NULL`,
      [vendorId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('Vendor not found.', 404, 'VENDOR_NOT_FOUND');
    }

    if (res.rows[0].owner_user_id !== userId) {
      throw new AppError('You do not have permission to manage this vendor store.', 403, 'FORBIDDEN');
    }
  }

  /**
   * Vendor: List products with customer-specific availability and pricing
   */
  public static async listCustomerProducts(
    vendorId: string,
    customerId: string,
    userId: string,
    userRoles: RoleCode[]
  ): Promise<{
    vendorId: string;
    customerId: string;
    restrictCustomerCatalog: boolean;
    products: CustomerProductConfig[];
  }> {
    await this.verifyVendorAccess(vendorId, userId, userRoles);

    // 1. Get vendor catalog restriction mode
    const vendorRes = await query<{ restrict_customer_catalog: boolean }>(
      `SELECT restrict_customer_catalog FROM vendor.vendors WHERE id = $1`,
      [vendorId]
    );

    const restrictCustomerCatalog = vendorRes.rows[0]?.restrict_customer_catalog || false;

    // 2. Fetch products with customer configuration
    const res = await query(
      `SELECT p.id as product_id, p.name, p.sku, p.regular_price, p.discount_price, p.is_active,
              COALESCE(cp.is_enabled, TRUE) as is_enabled,
              cp.custom_price
       FROM catalog.products p
       LEFT JOIN vendor.customer_products cp
         ON cp.product_id = p.id AND cp.customer_user_id = $2 AND cp.vendor_id = $1
       WHERE p.vendor_id = $1 AND p.deleted_at IS NULL
       ORDER BY p.name ASC`,
      [vendorId, customerId]
    );

    const products: CustomerProductConfig[] = res.rows.map((row) => {
      const regularPrice = parseFloat(row.regular_price);
      const discountPrice = row.discount_price ? parseFloat(row.discount_price) : null;
      const customPrice = row.custom_price !== null ? parseFloat(row.custom_price) : null;
      const effectivePrice = customPrice !== null ? customPrice : (discountPrice || regularPrice);

      return {
        productId: row.product_id,
        name: row.name,
        sku: row.sku,
        catalogRegularPrice: regularPrice,
        catalogDiscountPrice: discountPrice,
        isActive: row.is_active,
        isEnabled: row.is_enabled,
        customPrice,
        effectivePrice,
      };
    });

    return {
      vendorId,
      customerId,
      restrictCustomerCatalog,
      products,
    };
  }

  /**
   * Vendor: Configure customer product availability & custom pricing
   */
  public static async configureCustomerProducts(
    vendorId: string,
    customerId: string,
    userId: string,
    userRoles: RoleCode[],
    products: Array<{
      productId: string;
      isEnabled: boolean;
      customPrice?: number | null;
    }>
  ): Promise<{ updatedCount: number; message: string }> {
    await this.verifyVendorAccess(vendorId, userId, userRoles);

    // Verify customer exists
    const customerRes = await query<{ id: string }>(
      `SELECT id FROM identity.users WHERE id = $1 AND deleted_at IS NULL`,
      [customerId]
    );

    if (customerRes.rows.length === 0) {
      throw new AppError('Customer user not found.', 404, 'CUSTOMER_NOT_FOUND');
    }

    return await withTransaction(async (client) => {
      let count = 0;
      for (const p of products) {
        // Verify product belongs to this vendor
        const prodCheck = await client.query(
          `SELECT id FROM catalog.products WHERE id = $1 AND vendor_id = $2 AND deleted_at IS NULL`,
          [p.productId, vendorId]
        );

        if (prodCheck.rows.length === 0) {
          throw new AppError(
            `Product ${p.productId} does not belong to vendor ${vendorId}.`,
            400,
            'INVALID_PRODUCT_VENDOR'
          );
        }

        await client.query(
          `INSERT INTO vendor.customer_products (
             vendor_id, customer_user_id, product_id, is_enabled, custom_price
           ) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (vendor_id, customer_user_id, product_id)
           DO UPDATE SET is_enabled = EXCLUDED.is_enabled,
                         custom_price = EXCLUDED.custom_price,
                         updated_at = CURRENT_TIMESTAMP`,
          [
            vendorId,
            customerId,
            p.productId,
            p.isEnabled,
            p.customPrice !== undefined ? p.customPrice : null,
          ]
        );
        count++;
      }

      return {
        updatedCount: count,
        message: `Updated product availability and custom pricing for ${count} product(s).`,
      };
    });
  }

  /**
   * Vendor: Toggle customer catalog restriction setting
   */
  public static async toggleCatalogRestriction(
    vendorId: string,
    userId: string,
    userRoles: RoleCode[],
    restrictCustomerCatalog: boolean
  ): Promise<{ restrictCustomerCatalog: boolean; message: string }> {
    await this.verifyVendorAccess(vendorId, userId, userRoles);

    await query(
      `UPDATE vendor.vendors 
       SET restrict_customer_catalog = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [restrictCustomerCatalog, vendorId]
    );

    return {
      restrictCustomerCatalog,
      message: restrictCustomerCatalog
        ? 'Customer catalog restriction activated. Customers will only see explicitly enabled products.'
        : 'Customer catalog restriction deactivated. Customers can view all active vendor products.',
    };
  }
}
