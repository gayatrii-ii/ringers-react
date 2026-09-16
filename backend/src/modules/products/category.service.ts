import { query } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { slugify } from '../../utils/slug.js';
import { CreateCategoryInput, UpdateCategoryInput } from './category.validation.js';

export interface CategoryRecord {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
  children?: CategoryRecord[];
}

export class CategoryService {
  /**
   * Helper to resolve unique slug for a category
   */
  private static async resolveUniqueSlug(baseSlug: string, currentId?: string): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const checkRes = await query<{ id: string }>(
        `SELECT id FROM catalog.categories WHERE slug = $1 ${currentId ? 'AND id != $2' : ''} LIMIT 1`,
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
   * List categories, hierarchically nested by default
   */
  public static async listCategories(flat = false, status?: string): Promise<CategoryRecord[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (status) {
      conditions.push('status = $1');
      values.push(status);
    } else {
      conditions.push("status = 'ACTIVE'");
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const res = await query<CategoryRecord>(
      `SELECT id, parent_id, name, slug, description, status, created_at, updated_at
       FROM catalog.categories
       ${whereClause}
       ORDER BY name ASC`,
      values
    );

    const categories = res.rows;

    if (flat) {
      return categories;
    }

    // Build hierarchy
    const categoryMap = new Map<string, CategoryRecord>();
    categories.forEach((cat) => categoryMap.set(cat.id, { ...cat, children: [] }));

    const rootCategories: CategoryRecord[] = [];

    categoryMap.forEach((cat) => {
      if (cat.parent_id && categoryMap.has(cat.parent_id)) {
        categoryMap.get(cat.parent_id)!.children!.push(cat);
      } else {
        rootCategories.push(cat);
      }
    });

    return rootCategories;
  }

  /**
   * Get single category by ID or slug
   */
  public static async getCategoryByIdOrSlug(idOrSlug: string): Promise<CategoryRecord> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

    const res = await query<CategoryRecord>(
      `SELECT id, parent_id, name, slug, description, status, created_at, updated_at
       FROM catalog.categories
       WHERE ${isUuid ? 'id = $1' : 'slug = $1'}
       LIMIT 1`,
      [idOrSlug]
    );

    const category = res.rows[0];
    if (!category) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    // Fetch immediate child categories
    const childrenRes = await query<CategoryRecord>(
      `SELECT id, parent_id, name, slug, description, status, created_at, updated_at
       FROM catalog.categories
       WHERE parent_id = $1 AND status = 'ACTIVE'
       ORDER BY name ASC`,
      [category.id]
    );

    category.children = childrenRes.rows;
    return category;
  }

  /**
   * Create category
   */
  public static async createCategory(data: CreateCategoryInput): Promise<CategoryRecord> {
    const baseSlug = data.slug ? slugify(data.slug) : slugify(data.name);
    const slug = await this.resolveUniqueSlug(baseSlug);

    if (data.parentId) {
      const parent = await query<{ id: string }>(
        'SELECT id FROM catalog.categories WHERE id = $1',
        [data.parentId]
      );
      if (!parent.rows[0]) {
        throw new AppError('Specified parent category does not exist.', 400, 'PARENT_CATEGORY_NOT_FOUND');
      }
    }

    const res = await query<CategoryRecord>(
      `INSERT INTO catalog.categories (name, slug, parent_id, description, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        data.name.trim(),
        slug,
        data.parentId || null,
        data.description?.trim() || null,
        data.status || 'ACTIVE',
      ]
    );

    return res.rows[0]!;
  }

  /**
   * Update category
   */
  public static async updateCategory(id: string, data: UpdateCategoryInput): Promise<CategoryRecord> {
    const existing = await query<CategoryRecord>(
      'SELECT id, parent_id, name, slug FROM catalog.categories WHERE id = $1',
      [id]
    );
    if (!existing.rows[0]) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }

    if (data.parentId === id) {
      throw new AppError('Category cannot be its own parent.', 400, 'INVALID_PARENT_CATEGORY');
    }

    if (data.parentId) {
      const parent = await query<{ id: string }>(
        'SELECT id FROM catalog.categories WHERE id = $1',
        [data.parentId]
      );
      if (!parent.rows[0]) {
        throw new AppError('Specified parent category does not exist.', 400, 'PARENT_CATEGORY_NOT_FOUND');
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let index = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${index++}`);
      values.push(data.name.trim());
    }

    if (data.slug !== undefined) {
      const uniqueSlug = await this.resolveUniqueSlug(slugify(data.slug), id);
      fields.push(`slug = $${index++}`);
      values.push(uniqueSlug);
    } else if (data.name !== undefined && data.slug === undefined) {
      // Auto-update slug if name changed
      const uniqueSlug = await this.resolveUniqueSlug(slugify(data.name), id);
      fields.push(`slug = $${index++}`);
      values.push(uniqueSlug);
    }

    if (data.parentId !== undefined) {
      fields.push(`parent_id = $${index++}`);
      values.push(data.parentId);
    }

    if (data.description !== undefined) {
      fields.push(`description = $${index++}`);
      values.push(data.description ? data.description.trim() : null);
    }

    if (data.status !== undefined) {
      fields.push(`status = $${index++}`);
      values.push(data.status);
    }

    if (fields.length === 0) {
      return existing.rows[0];
    }

    values.push(id);
    const updateSql = `
      UPDATE catalog.categories
      SET ${fields.join(', ')}
      WHERE id = $${index}
      RETURNING *
    `;

    const res = await query<CategoryRecord>(updateSql, values);
    return res.rows[0]!;
  }

  /**
   * Delete or deactivate category
   */
  public static async deleteCategory(id: string): Promise<void> {
    const res = await query<{ id: string }>(
      `UPDATE catalog.categories
       SET status = 'INACTIVE'
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (!res.rows[0]) {
      throw new AppError('Category not found.', 404, 'CATEGORY_NOT_FOUND');
    }
  }
}
