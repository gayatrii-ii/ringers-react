import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { slugify } from '../../utils/slug.js';
import {
  CreateProductInput,
  UpdateProductInput,
  CreateProductVariantInput,
  UpdateProductVariantInput,
  AddProductImageInput,
  ProductQueryInput,
} from './product.validation.js';

export interface ProductVariantRecord {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  price: number;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export interface ProductImageRecord {
  id: string;
  product_id: string;
  image_url: string;
  sort_order: number;
  is_primary: boolean;
  created_at: Date;
}

export interface ProductRecord {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  category_id: string | null;
  category_name?: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string;
  price: number;
  discount_price: number | null;
  tax_rate: number;
  status: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  primary_image?: string | null;
  variants?: ProductVariantRecord[];
  images?: ProductImageRecord[];
}

export interface PaginatedProducts {
  products: ProductRecord[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ProductService {
  /**
   * Helper to ensure unique slug for product
   */
  private static async resolveUniqueSlug(baseSlug: string, currentId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const checkRes = await query<{ id: string }>(
        `SELECT id FROM catalog.products WHERE slug = $1 ${currentId ? 'AND id != $2' : ''} LIMIT 1`,
        currentId ? [slug, currentId] : [slug]
      );

      if (checkRes.rows.length === 0) {
        return slug;
      }

      counter++;
      slug = `${baseSlug}-${counter}`;
    }
  }

  /**
   * Helper to verify product ownership
   */
  private static async verifyProductOwnership(productId: string, vendorId: string, isAdmin = false): Promise<ProductRecord> {
    const res = await query<ProductRecord>(
      `SELECT * FROM catalog.products WHERE id = $1 AND deleted_at IS NULL`,
      [productId]
    );

    const product = res.rows[0];
    if (!product) {
      throw new AppError('Product not found or has been deleted.', 404, 'PRODUCT_NOT_FOUND');
    }

    if (!isAdmin && product.vendor_id !== vendorId) {
      throw new AppError('You do not have permission to manage this product.', 403, 'FORBIDDEN');
    }

    return product;
  }

  /**
   * List products across platform with filtering and search
   */
  public static async listProducts(filters: ProductQueryInput): Promise<PaginatedProducts> {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = ['p.deleted_at IS NULL'];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (filters.vendorId) {
      conditions.push(`p.vendor_id = $${paramIndex++}`);
      values.push(filters.vendorId);
    }

    if (filters.categoryId) {
      conditions.push(`p.category_id = $${paramIndex++}`);
      values.push(filters.categoryId);
    }

    if (filters.status) {
      conditions.push(`p.status = $${paramIndex++}`);
      values.push(filters.status);
    } else {
      conditions.push(`p.status != 'DISCONTINUED'`);
    }

    if (filters.search) {
      conditions.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex} OR p.sku ILIKE $${paramIndex})`);
      values.push(`%${filters.search.trim()}%`);
      paramIndex++;
    }

    if (filters.minPrice !== undefined) {
      conditions.push(`p.price >= $${paramIndex++}`);
      values.push(filters.minPrice);
    }

    if (filters.maxPrice !== undefined) {
      conditions.push(`p.price <= $${paramIndex++}`);
      values.push(filters.maxPrice);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total Count
    const countRes = await query<{ total: string }>(
      `SELECT COUNT(*) as total FROM catalog.products p ${whereClause}`,
      values
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Fetch Products with Vendor and Category Names, and Primary Image
    const dataSql = `
      SELECT 
        p.id, p.vendor_id, v.business_name as vendor_name,
        p.category_id, c.name as category_name,
        p.name, p.slug, p.description, p.sku,
        p.price, p.discount_price, p.tax_rate, p.status,
        p.created_at, p.updated_at,
        (
          SELECT pi.image_url 
          FROM catalog.product_images pi 
          WHERE pi.product_id = p.id 
          ORDER BY pi.is_primary DESC, pi.sort_order ASC 
          LIMIT 1
        ) as primary_image
      FROM catalog.products p
      LEFT JOIN vendor.vendors v ON p.vendor_id = v.id
      LEFT JOIN catalog.categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    values.push(limit, offset);
    const result = await query<ProductRecord>(dataSql, values);

    return {
      products: result.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single product detail by ID or Slug with all variants and images
   */
  public static async getProductByIdOrSlug(idOrSlug: string): Promise<ProductRecord> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const res = await query<ProductRecord>(
      `SELECT 
        p.id, p.vendor_id, v.business_name as vendor_name,
        p.category_id, c.name as category_name,
        p.name, p.slug, p.description, p.sku,
        p.price, p.discount_price, p.tax_rate, p.status,
        p.created_at, p.updated_at, p.deleted_at
       FROM catalog.products p
       LEFT JOIN vendor.vendors v ON p.vendor_id = v.id
       LEFT JOIN catalog.categories c ON p.category_id = c.id
       WHERE ${isUuid ? 'p.id = $1' : 'p.slug = $1'} AND p.deleted_at IS NULL
       LIMIT 1`,
      [idOrSlug]
    );

    const product = res.rows[0];
    if (!product) {
      throw new AppError('Product not found.', 404, 'PRODUCT_NOT_FOUND');
    }

    // Fetch Variants
    const variantsRes = await query<ProductVariantRecord>(
      `SELECT id, product_id, name, sku, price, status, created_at, updated_at
       FROM catalog.product_variants
       WHERE product_id = $1
       ORDER BY price ASC`,
      [product.id]
    );

    // Fetch Images
    const imagesRes = await query<ProductImageRecord>(
      `SELECT id, product_id, image_url, sort_order, is_primary, created_at
       FROM catalog.product_images
       WHERE product_id = $1
       ORDER BY is_primary DESC, sort_order ASC`,
      [product.id]
    );

    product.variants = variantsRes.rows;
    product.images = imagesRes.rows;
    product.primary_image = imagesRes.rows.find((img) => img.is_primary)?.image_url || imagesRes.rows[0]?.image_url || null;

    return product;
  }

  /**
   * Create new product under vendor catalog with initial variants and images (Atomic)
   */
  public static async createProduct(vendorId: string, data: CreateProductInput): Promise<ProductRecord> {
    return await withTransaction(async (client) => {
      // 1. Verify vendor exists and is active
      const vendorCheck = await client.query<{ id: string; status: string }>(
        'SELECT id, status FROM vendor.vendors WHERE id = $1 AND deleted_at IS NULL',
        [vendorId]
      );
      if (!vendorCheck.rows[0]) {
        throw new AppError('Vendor store does not exist.', 404, 'VENDOR_NOT_FOUND');
      }

      // 2. Verify category exists if provided
      if (data.categoryId) {
        const catCheck = await client.query('SELECT id FROM catalog.categories WHERE id = $1', [data.categoryId]);
        if (!catCheck.rows[0]) {
          throw new AppError('Specified category does not exist.', 400, 'CATEGORY_NOT_FOUND');
        }
      }

      // 3. Check SKU uniqueness for this vendor
      const skuCheck = await client.query(
        'SELECT id FROM catalog.products WHERE vendor_id = $1 AND LOWER(sku) = LOWER($2) AND deleted_at IS NULL',
        [vendorId, data.sku.trim()]
      );
      if (skuCheck.rows.length > 0) {
        throw new AppError(`Product SKU "${data.sku}" is already in use by your store.`, 409, 'SKU_ALREADY_EXISTS');
      }

      // 4. Resolve slug
      const slug = await this.resolveUniqueSlug(slugify(data.name));

      // 5. Insert Product
      const productRes = await client.query<ProductRecord>(
        `INSERT INTO catalog.products (
           vendor_id, category_id, name, slug, description, sku,
           price, discount_price, tax_rate, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          vendorId,
          data.categoryId || null,
          data.name.trim(),
          slug,
          data.description?.trim() || null,
          data.sku.trim().toUpperCase(),
          data.price,
          data.discountPrice ?? null,
          data.taxRate ?? 0.0,
          data.status || 'AVAILABLE',
        ]
      );

      const product = productRes.rows[0]!;

      // 6. Insert initial variants
      if (data.variants && data.variants.length > 0) {
        for (const variant of data.variants) {
          await client.query(
            `INSERT INTO catalog.product_variants (product_id, name, sku, price, status)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              product.id,
              variant.name.trim(),
              variant.sku.trim().toUpperCase(),
              variant.price,
              variant.status || 'AVAILABLE',
            ]
          );
        }
      }

      // 7. Insert initial images
      if (data.images && data.images.length > 0) {
        for (let i = 0; i < data.images.length; i++) {
          const img = data.images[i]!;
          await client.query(
            `INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_primary)
             VALUES ($1, $2, $3, $4)`,
            [product.id, img.imageUrl.trim(), img.sortOrder ?? i, img.isPrimary ?? i === 0]
          );
        }
      }

      return product;
    });
  }

  /**
   * Update product attributes
   */
  public static async updateProduct(
    productId: string,
    vendorId: string,
    data: UpdateProductInput,
    isAdmin = false
  ): Promise<ProductRecord> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    if (data.categoryId) {
      const catCheck = await query('SELECT id FROM catalog.categories WHERE id = $1', [data.categoryId]);
      if (!catCheck.rows[0]) {
        throw new AppError('Specified category does not exist.', 400, 'CATEGORY_NOT_FOUND');
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(data.name.trim());

      // Auto update slug
      const uniqueSlug = await this.resolveUniqueSlug(slugify(data.name), productId);
      fields.push(`slug = $${index++}`);
      values.push(uniqueSlug);
    }

    if (data.categoryId !== undefined) {
      fields.push(`category_id = $${index++}`);
      values.push(data.categoryId);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(data.description ? data.description.trim() : null);
    }

    if (data.price !== undefined) {
      fields.push(`price = $${index++}`);
      values.push(data.price);
    }

    if (data.discountPrice !== undefined) {
      fields.push(`discount_price = $${index++}`);
      values.push(data.discountPrice);
    }

    if (data.taxRate !== undefined) {
      fields.push(`tax_rate = $${index++}`);
      values.push(data.taxRate);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${index++}`);
      values.push(data.status);
    }

    if (fields.length === 0) {
      return await this.getProductByIdOrSlug(productId);
    }

    values.push(productId);
    const updateSql = `
      UPDATE catalog.products
      SET ${fields.join(', ')}
      WHERE id = $${index} AND deleted_at IS NULL
      RETURNING id
    `;

    await query(updateSql, values);
    return await this.getProductByIdOrSlug(productId);
  }

  /**
   * Quick toggle for product status (AVAILABLE / OUT_OF_STOCK / DISCONTINUED)
   */
  public static async updateProductStatus(
    productId: string,
    vendorId: string,
    status: string,
    isAdmin = false
  ): Promise<ProductRecord> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    await query(
      `UPDATE catalog.products SET status = $1 WHERE id = $2 AND deleted_at IS NULL`,
      [status, productId]
    );

    return await this.getProductByIdOrSlug(productId);
  }

  /**
   * Soft delete product
   */
  public static async deleteProduct(productId: string, vendorId: string, isAdmin = false): Promise<void> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    await query(
      `UPDATE catalog.products SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [productId]
    );
  }

  /**
   * Add variant to product
   */
  public static async addVariant(
    productId: string,
    vendorId: string,
    data: CreateProductVariantInput,
    isAdmin = false
  ): Promise<ProductVariantRecord> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    try {
      const res = await query<ProductVariantRecord>(
        `INSERT INTO catalog.product_variants (product_id, name, sku, price, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [productId, data.name.trim(), data.sku.trim().toUpperCase(), data.price, data.status || 'AVAILABLE']
      );
      return res.rows[0]!;
    } catch (err: any) {
      if (err.code === '23505') {
        throw new AppError(`Variant SKU "${data.sku}" already exists for this product.`, 409, 'VARIANT_SKU_EXISTS');
      }
      throw err;
    }
  }

  /**
   * Update variant
   */
  public static async updateVariant(
    variantId: string,
    productId: string,
    vendorId: string,
    data: UpdateProductVariantInput,
    isAdmin = false
  ): Promise<ProductVariantRecord> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.name !== undefined) fields.push(`name = $${index++}`), values.push(data.name.trim());
    if (data.sku !== undefined) fields.push(`sku = $${index++}`), values.push(data.sku.trim().toUpperCase());
    if (data.price !== undefined) fields.push(`price = $${index++}`), values.push(data.price);
    if (data.status !== undefined) fields.push(`status = $${index++}`), values.push(data.status);

    if (fields.length === 0) {
      const current = await query<ProductVariantRecord>(
        'SELECT * FROM catalog.product_variants WHERE id = $1 AND product_id = $2',
        [variantId, productId]
      );
      if (!current.rows[0]) throw new AppError('Variant not found.', 404, 'VARIANT_NOT_FOUND');
      return current.rows[0];
    }

    values.push(variantId, productId);
    const updateSql = `
      UPDATE catalog.product_variants
      SET ${fields.join(', ')}
      WHERE id = $${index++} AND product_id = $${index++}
      RETURNING *
    `;

    const res = await query<ProductVariantRecord>(updateSql, values);
    if (!res.rows[0]) {
      throw new AppError('Variant not found.', 404, 'VARIANT_NOT_FOUND');
    }

    return res.rows[0];
  }

  /**
   * Delete variant
   */
  public static async deleteVariant(variantId: string, productId: string, vendorId: string, isAdmin = false): Promise<void> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    const res = await query(
      `DELETE FROM catalog.product_variants WHERE id = $1 AND product_id = $2 RETURNING id`,
      [variantId, productId]
    );

    if (!res.rows[0]) {
      throw new AppError('Variant not found.', 404, 'VARIANT_NOT_FOUND');
    }
  }

  /**
   * Add image asset to product
   */
  public static async addImage(
    productId: string,
    vendorId: string,
    data: AddProductImageInput,
    isAdmin = false
  ): Promise<ProductImageRecord> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    return await withTransaction(async (client) => {
      if (data.isPrimary) {
        await client.query(
          `UPDATE catalog.product_images SET is_primary = FALSE WHERE product_id = $1`,
          [productId]
        );
      }

      const res = await client.query<ProductImageRecord>(
        `INSERT INTO catalog.product_images (product_id, image_url, sort_order, is_primary)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [productId, data.imageUrl.trim(), data.sortOrder ?? 0, data.isPrimary ?? false]
      );

      return res.rows[0]!;
    });
  }

  /**
   * Delete image from product
   */
  public static async deleteImage(imageId: string, productId: string, vendorId: string, isAdmin = false): Promise<void> {
    await this.verifyProductOwnership(productId, vendorId, isAdmin);

    const res = await query(
      `DELETE FROM catalog.product_images WHERE id = $1 AND product_id = $2 RETURNING id`,
      [imageId, productId]
    );

    if (!res.rows[0]) {
      throw new AppError('Image not found.', 404, 'IMAGE_NOT_FOUND');
    }
  }
}
