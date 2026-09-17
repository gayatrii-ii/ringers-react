import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';

export interface ReviewResponse {
  id: string;
  orderId: string;
  customerId: string;
  customerName?: string;
  vendorId: string;
  deliveryPartnerId: string | null;
  vendorRating: number;
  deliveryRating: number | null;
  vendorReview: string | null;
  deliveryReview: string | null;
  createdAt: string;
}

export interface VendorReviewSummary {
  vendorId: string;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  reviews: ReviewResponse[];
  page: number;
  limit: number;
  total: number;
}

export class ReviewService {
  private static mapReview(row: any): ReviewResponse {
    return {
      id: row.id,
      orderId: row.order_id,
      customerId: row.customer_id,
      customerName: row.customer_name || 'Verified Customer',
      vendorId: row.vendor_id,
      deliveryPartnerId: row.delivery_partner_id ?? null,
      vendorRating: row.vendor_rating,
      deliveryRating: row.delivery_rating ?? null,
      vendorReview: row.vendor_review ?? null,
      deliveryReview: row.delivery_review ?? null,
      createdAt: row.created_at,
    };
  }

  /**
   * 1. Submit review for a DELIVERED order
   */
  public static async createReview(
    customerId: string,
    data: {
      orderId: string;
      vendorRating: number;
      deliveryRating?: number | null;
      vendorReview?: string | null;
      deliveryReview?: string | null;
    }
  ): Promise<ReviewResponse> {
    const { orderId, vendorRating, deliveryRating, vendorReview, deliveryReview } = data;

    // 1. Verify order exists, belongs to caller, and is DELIVERED
    const orderRes = await query(
      `SELECT id, customer_id, vendor_id, delivery_partner_id, status 
       FROM order_management.orders 
       WHERE id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0 || !orderRes.rows[0]) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];

    if (order.customer_id !== customerId) {
      throw new AppError('You can only review orders you placed', 403, 'FORBIDDEN');
    }

    if (order.status !== 'DELIVERED') {
      throw new AppError('Only completed and delivered orders can be reviewed', 400, 'ORDER_NOT_DELIVERED');
    }

    // 2. Check if already reviewed (unique constraint guard)
    const existing = await query(
      `SELECT id FROM customer.reviews WHERE order_id = $1`,
      [orderId]
    );

    if (existing.rows.length > 0) {
      throw new AppError('You have already submitted a review for this order', 400, 'ALREADY_REVIEWED');
    }

    // 3. Atomically insert review and recalculate vendor average rating
    return await withTransaction(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO customer.reviews (
           order_id, customer_id, vendor_id, delivery_partner_id,
           vendor_rating, delivery_rating, vendor_review, delivery_review,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         RETURNING *`,
        [
          orderId,
          customerId,
          order.vendor_id,
          order.delivery_partner_id || null,
          vendorRating,
          deliveryRating || null,
          vendorReview?.trim() || null,
          deliveryReview?.trim() || null,
        ]
      );

      // Recalculate vendor's aggregate rating
      const statsRes = await client.query(
        `SELECT ROUND(AVG(vendor_rating)::numeric, 2) AS avg_rating, COUNT(*) AS total_count
         FROM customer.reviews
         WHERE vendor_id = $1`,
        [order.vendor_id]
      );

      const avgRating = parseFloat(statsRes.rows[0]?.avg_rating || '5.00');
      const totalReviews = parseInt(statsRes.rows[0]?.total_count || '1', 10);

      await client.query(
        `UPDATE vendor.vendors 
         SET rating = $1, total_reviews = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [avgRating, totalReviews, order.vendor_id]
      );

      return ReviewService.mapReview(insertRes.rows[0]);
    });
  }

  /**
   * 2. Get paginated reviews & rating distribution for a vendor
   */
  public static async getVendorReviews(
    vendorId: string,
    filter: { page: number; limit: number }
  ): Promise<VendorReviewSummary> {
    // 1. Get aggregate stats & rating distribution
    const statsRes = await query(
      `SELECT 
         ROUND(COALESCE(AVG(vendor_rating), 5.00)::numeric, 2) AS avg_rating,
         COUNT(*) AS total_count,
         COUNT(*) FILTER (WHERE vendor_rating = 1) AS star_1,
         COUNT(*) FILTER (WHERE vendor_rating = 2) AS star_2,
         COUNT(*) FILTER (WHERE vendor_rating = 3) AS star_3,
         COUNT(*) FILTER (WHERE vendor_rating = 4) AS star_4,
         COUNT(*) FILTER (WHERE vendor_rating = 5) AS star_5
       FROM customer.reviews
       WHERE vendor_id = $1`,
      [vendorId]
    );

    const stats = statsRes.rows[0];
    const total = parseInt(stats?.total_count || '0', 10);
    const avgRating = parseFloat(stats?.avg_rating || '5.00');

    const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
      1: parseInt(stats?.star_1 || '0', 10),
      2: parseInt(stats?.star_2 || '0', 10),
      3: parseInt(stats?.star_3 || '0', 10),
      4: parseInt(stats?.star_4 || '0', 10),
      5: parseInt(stats?.star_5 || '0', 10),
    };

    // 2. Fetch paginated reviews with masked customer name
    const offset = (filter.page - 1) * filter.limit;
    const listRes = await query(
      `SELECT r.*, 
              CONCAT(SUBSTRING(u.first_name FROM 1 FOR 1), '*** ', SUBSTRING(u.last_name FROM 1 FOR 1), '.') AS customer_name
       FROM customer.reviews r
       JOIN identity.users u ON u.id = r.customer_id
       WHERE r.vendor_id = $1
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [vendorId, filter.limit, offset]
    );

    return {
      vendorId,
      averageRating: avgRating,
      totalReviews: total,
      ratingDistribution,
      reviews: listRes.rows.map(ReviewService.mapReview),
      page: filter.page,
      limit: filter.limit,
      total,
    };
  }

  /**
   * 3. Get reviews written by the authenticated customer
   */
  public static async getCustomerReviews(customerId: string): Promise<ReviewResponse[]> {
    const res = await query(
      `SELECT r.*, v.business_name AS vendor_name
       FROM customer.reviews r
       JOIN vendor.vendors v ON v.id = r.vendor_id
       WHERE r.customer_id = $1
       ORDER BY r.created_at DESC`,
      [customerId]
    );

    return res.rows.map(ReviewService.mapReview);
  }
}
