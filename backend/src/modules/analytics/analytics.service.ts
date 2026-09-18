import { query } from '../../config/database.js';

// ─────────────────────────────────────────────────────────────
// Date range helpers
// ─────────────────────────────────────────────────────────────

function buildDateFilter(
  period: string,
  startDate?: string,
  endDate?: string,
  columnName = 'created_at',
  paramOffset = 1
): { sql: string; params: unknown[] } {
  if (period === 'custom' && startDate && endDate) {
    const p1 = `$${paramOffset}`;
    const p2 = `$${paramOffset + 1}`;
    return {
      sql: `${columnName} >= ${p1} AND ${columnName} < (${p2}::date + INTERVAL '1 day')`,
      params: [startDate, endDate],
    };
  }

  const intervals: Record<string, string> = {
    today: '1 day',
    week: '7 days',
    month: '30 days',
    year: '365 days',
  };
  const interval = intervals[period] || '30 days';
  return {
    sql: `${columnName} >= NOW() - INTERVAL '${interval}'`,
    params: [],
  };
}

// ─────────────────────────────────────────────────────────────
// Admin Analytics Service
// ─────────────────────────────────────────────────────────────

export interface AdminOverviewMetrics {
  period: string;
  orders: {
    total: number;
    completed: number;
    cancelled: number;
    pending: number;
    completionRate: string;
    cancellationRate: string;
  };
  revenue: {
    grossMerchandiseValue: number;
    platformCommission: number;
    totalRefunds: number;
    netRevenue: number;
  };
  users: {
    totalCustomers: number;
    totalVendors: number;
    totalDeliveryPartners: number;
    totalActiveUsers: number;
  };
  wallet: {
    totalWalletBalance: number;
    totalWalletTransactions: number;
  };
}

export interface VendorLeaderboardEntry {
  rank: number;
  vendorId: string;
  businessName: string;
  totalOrders: number;
  completedOrders: number;
  totalRevenue: number;
  averageRating: number;
  totalReviews: number;
}

export interface DeliveryPerformanceMetrics {
  totalDeliveries: number;
  completedDeliveries: number;
  averageDeliveryTimeMinutes: number;
  topPerformers: Array<{
    riderId: string;
    riderName: string;
    totalDeliveries: number;
    completedDeliveries: number;
  }>;
}

export class AnalyticsService {
  /**
   * 1. Super Admin Platform Overview
   * GMV, revenue, user counts, wallet summary
   */
  public static async getAdminOverview(
    period: string,
    startDate?: string,
    endDate?: string
  ): Promise<AdminOverviewMetrics> {
    const dateFilter = buildDateFilter(period, startDate, endDate, 'created_at', 1);

    // Order metrics
    const orderRes = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') AS completed,
         COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
         COUNT(*) FILTER (WHERE status NOT IN ('DELIVERED','CANCELLED')) AS pending,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'DELIVERED'), 0) AS gmv,
         COALESCE(SUM(total_amount) FILTER (WHERE payment_status = 'REFUNDED'), 0) AS total_refunds
       FROM order_management.orders
       WHERE ${dateFilter.sql}`,
      dateFilter.params
    );

    const orders = orderRes.rows[0] || {};
    const totalOrders = parseInt(orders.total || '0', 10);
    const completedOrders = parseInt(orders.completed || '0', 10);
    const cancelledOrders = parseInt(orders.cancelled || '0', 10);
    const pendingOrders = parseInt(orders.pending || '0', 10);
    const gmv = parseFloat(orders.gmv || '0');
    const totalRefunds = parseFloat(orders.total_refunds || '0');
    const platformCommission = Math.round(gmv * 0.10 * 100) / 100;
    const netRevenue = Math.round((platformCommission - totalRefunds) * 100) / 100;

    // User metrics
    const userRes = await query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'ACTIVE') AS total_active,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM identity.user_roles ur
           JOIN identity.roles r ON r.id = ur.role_id
           WHERE ur.user_id = identity.users.id AND r.code = 'CUSTOMER'
         )) AS customers,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM identity.user_roles ur
           JOIN identity.roles r ON r.id = ur.role_id
           WHERE ur.user_id = identity.users.id AND r.code = 'VENDOR'
         )) AS vendors,
         COUNT(*) FILTER (WHERE EXISTS (
           SELECT 1 FROM identity.user_roles ur
           JOIN identity.roles r ON r.id = ur.role_id
           WHERE ur.user_id = identity.users.id AND r.code = 'DELIVERY_BOY'
         )) AS delivery_partners
       FROM identity.users`,
      []
    );

    const userRow = userRes.rows[0] || {};

    // Wallet summary
    const walletRes = await query(
      `SELECT
         COALESCE(SUM(balance), 0) AS total_balance,
         (SELECT COUNT(*) FROM payment.wallet_transactions) AS total_transactions
       FROM payment.wallets WHERE is_active = TRUE`,
      []
    );

    const walletRow = walletRes.rows[0] || {};

    return {
      period,
      orders: {
        total: totalOrders,
        completed: completedOrders,
        cancelled: cancelledOrders,
        pending: pendingOrders,
        completionRate:
          totalOrders > 0 ? ((completedOrders / totalOrders) * 100).toFixed(1) + '%' : '0%',
        cancellationRate:
          totalOrders > 0 ? ((cancelledOrders / totalOrders) * 100).toFixed(1) + '%' : '0%',
      },
      revenue: {
        grossMerchandiseValue: gmv,
        platformCommission,
        totalRefunds,
        netRevenue: netRevenue > 0 ? netRevenue : 0,
      },
      users: {
        totalCustomers: parseInt(userRow.customers || '0', 10),
        totalVendors: parseInt(userRow.vendors || '0', 10),
        totalDeliveryPartners: parseInt(userRow.delivery_partners || '0', 10),
        totalActiveUsers: parseInt(userRow.total_active || '0', 10),
      },
      wallet: {
        totalWalletBalance: parseFloat(walletRow.total_balance || '0'),
        totalWalletTransactions: parseInt(walletRow.total_transactions || '0', 10),
      },
    };
  }

  /**
   * 2. Top Vendors Leaderboard by Sales Revenue
   */
  public static async getVendorLeaderboard(
    period: string,
    limit: number = 10
  ): Promise<VendorLeaderboardEntry[]> {
    const dateFilter = buildDateFilter(period, undefined, undefined, 'o.created_at', 1);
    const limitIndex = dateFilter.params.length + 1;

    const res = await query(
      `SELECT
         v.id AS vendor_id,
         v.business_name,
         v.rating AS average_rating,
         v.total_reviews,
         COUNT(o.id) AS total_orders,
         COUNT(o.id) FILTER (WHERE o.status = 'DELIVERED') AS completed_orders,
         COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'DELIVERED'), 0) AS total_revenue
       FROM vendor.vendors v
       LEFT JOIN order_management.orders o 
         ON o.vendor_id = v.id AND ${dateFilter.sql}
       WHERE v.status = 'ACTIVE'
       GROUP BY v.id, v.business_name, v.rating, v.total_reviews
       ORDER BY total_revenue DESC
       LIMIT $${limitIndex}`,
      [...dateFilter.params, limit]
    );

    return res.rows.map((row, idx) => ({
      rank: idx + 1,
      vendorId: row.vendor_id,
      businessName: row.business_name,
      totalOrders: parseInt(row.total_orders || '0', 10),
      completedOrders: parseInt(row.completed_orders || '0', 10),
      totalRevenue: parseFloat(row.total_revenue || '0'),
      averageRating: parseFloat(row.average_rating || '5.00'),
      totalReviews: parseInt(row.total_reviews || '0', 10),
    }));
  }

  /**
   * 3. Delivery Fleet Performance Overview
   */
  public static async getDeliveryPerformance(
    period: string,
    startDate?: string,
    endDate?: string
  ): Promise<DeliveryPerformanceMetrics> {
    const dateFilter = buildDateFilter(period, startDate, endDate, 'created_at', 1);
    const riderDateFilter = buildDateFilter(period, startDate, endDate, 'o.created_at', 1);

    // Overall delivery stats
    const statsRes = await query(
      `SELECT
         COUNT(*) AS total_deliveries,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') AS completed,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (completed_at - confirmed_at)) / 60)
           FILTER (WHERE status = 'DELIVERED' AND completed_at IS NOT NULL AND confirmed_at IS NOT NULL),
           1
         ) AS avg_delivery_minutes
       FROM order_management.orders
       WHERE ${dateFilter.sql}`,
      dateFilter.params
    );

    const stats = statsRes.rows[0] || {};

    // Top delivery partners
    const ridersRes = await query(
      `SELECT
         dp.user_id AS rider_id,
         CONCAT(u.first_name, ' ', u.last_name) AS rider_name,
         COUNT(o.id) AS total_deliveries,
         COUNT(o.id) FILTER (WHERE o.status = 'DELIVERED') AS completed_deliveries
       FROM delivery.delivery_partners dp
       JOIN identity.users u ON u.id = dp.user_id
       LEFT JOIN order_management.orders o 
         ON o.delivery_partner_id = dp.user_id AND ${riderDateFilter.sql}
       GROUP BY dp.user_id, u.first_name, u.last_name
       ORDER BY completed_deliveries DESC
       LIMIT 10`,
      riderDateFilter.params
    );

    return {
      totalDeliveries: parseInt(stats.total_deliveries || '0', 10),
      completedDeliveries: parseInt(stats.completed || '0', 10),
      averageDeliveryTimeMinutes: parseFloat(stats.avg_delivery_minutes || '0'),
      topPerformers: ridersRes.rows.map((row) => ({
        riderId: row.rider_id,
        riderName: row.rider_name,
        totalDeliveries: parseInt(row.total_deliveries || '0', 10),
        completedDeliveries: parseInt(row.completed_deliveries || '0', 10),
      })),
    };
  }

  /**
   * 4. Vendor Dashboard: My Store Overview
   */
  public static async getVendorOverview(
    vendorId: string,
    period: string,
    startDate?: string,
    endDate?: string
  ): Promise<{
    period: string;
    orders: { total: number; completed: number; cancelled: number; pending: number };
    revenue: { gross: number; vendorPayout: number; commission: number };
    averageOrderValue: number;
    topProducts: Array<{ productName: string; totalSold: number; revenue: number }>;
    rating: { average: number; totalReviews: number };
  }> {
    const orderDateFilter = buildDateFilter(period, startDate, endDate, 'created_at', 2);
    const prodDateFilter = buildDateFilter(period, startDate, endDate, 'o.created_at', 2);

    // Order & revenue stats
    const orderRes = await query(
      `SELECT
         COUNT(*) AS total,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') AS completed,
         COUNT(*) FILTER (WHERE status = 'CANCELLED') AS cancelled,
         COUNT(*) FILTER (WHERE status NOT IN ('DELIVERED','CANCELLED')) AS pending,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'DELIVERED'), 0) AS gross,
         COALESCE(AVG(total_amount) FILTER (WHERE status = 'DELIVERED'), 0) AS avg_order
       FROM order_management.orders
       WHERE vendor_id = $1 AND ${orderDateFilter.sql}`,
      [vendorId, ...orderDateFilter.params]
    );

    const orderRow = orderRes.rows[0] || {};
    const gross = parseFloat(orderRow.gross || '0');
    const commission = Math.round(gross * 0.10 * 100) / 100;
    const vendorPayout = Math.round((gross - commission) * 100) / 100;

    // Top 5 products by quantity sold
    const productsRes = await query(
      `SELECT
         p.name AS product_name,
         SUM(oi.quantity) AS total_sold,
         SUM(oi.quantity * oi.unit_price) AS revenue
       FROM order_management.order_items oi
       JOIN catalog.products p ON p.id = oi.product_id
       JOIN order_management.orders o ON o.id = oi.order_id
       WHERE o.vendor_id = $1
         AND o.status = 'DELIVERED'
         AND ${prodDateFilter.sql}
       GROUP BY p.name
       ORDER BY total_sold DESC
       LIMIT 5`,
      [vendorId, ...prodDateFilter.params]
    );

    // Rating summary
    const ratingRes = await query(
      `SELECT rating, total_reviews FROM vendor.vendors WHERE id = $1`,
      [vendorId]
    );

    const ratingRow = ratingRes.rows[0] || {};

    return {
      period,
      orders: {
        total: parseInt(orderRow.total || '0', 10),
        completed: parseInt(orderRow.completed || '0', 10),
        cancelled: parseInt(orderRow.cancelled || '0', 10),
        pending: parseInt(orderRow.pending || '0', 10),
      },
      revenue: {
        gross,
        vendorPayout,
        commission,
      },
      averageOrderValue: Math.round(parseFloat(orderRow.avg_order || '0') * 100) / 100,
      topProducts: productsRes.rows.map((row) => ({
        productName: row.product_name,
        totalSold: parseInt(row.total_sold || '0', 10),
        revenue: parseFloat(row.revenue || '0'),
      })),
      rating: {
        average: parseFloat(ratingRow.rating || '5.00'),
        totalReviews: parseInt(ratingRow.total_reviews || '0', 10),
      },
    };
  }

  /**
   * 5. Vendor Dashboard: Sales Revenue Trend (Daily / Weekly Time Series)
   */
  public static async getVendorSalesTrend(
    vendorId: string,
    period: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    date: string;
    totalOrders: number;
    completedOrders: number;
    grossSales: number;
  }>> {
    const dateFilter = buildDateFilter(period, startDate, endDate, 'created_at', 2);

    const res = await query<{
      date_group: string;
      total_orders: string;
      completed_orders: string;
      gross_sales: string;
    }>(
      `SELECT 
         TO_CHAR(created_at, 'YYYY-MM-DD') AS date_group,
         COUNT(*) AS total_orders,
         COUNT(*) FILTER (WHERE status = 'DELIVERED') AS completed_orders,
         COALESCE(SUM(total_amount) FILTER (WHERE status = 'DELIVERED'), 0) AS gross_sales
       FROM order_management.orders
       WHERE vendor_id = $1 AND ${dateFilter.sql}
       GROUP BY date_group
       ORDER BY date_group ASC`,
      [vendorId, ...dateFilter.params]
    );

    return res.rows.map((r) => ({
      date: r.date_group,
      totalOrders: parseInt(r.total_orders || '0', 10),
      completedOrders: parseInt(r.completed_orders || '0', 10),
      grossSales: parseFloat(r.gross_sales || '0'),
    }));
  }

  /**
   * 6. Vendor Dashboard: Payment Method Breakdown (Cash vs Online vs Wallet)
   */
  public static async getVendorPaymentBreakdown(
    vendorId: string,
    period: string,
    startDate?: string,
    endDate?: string
  ): Promise<Array<{
    paymentMethod: string;
    totalOrders: number;
    totalAmount: number;
    percentage: number;
  }>> {
    const dateFilter = buildDateFilter(period, startDate, endDate, 'created_at', 2);

    const res = await query<{
      payment_method: string;
      total_orders: string;
      total_amount: string;
    }>(
      `SELECT 
         COALESCE(payment_method, 'UNKNOWN') AS payment_method,
         COUNT(*) AS total_orders,
         COALESCE(SUM(total_amount), 0) AS total_amount
       FROM order_management.orders
       WHERE vendor_id = $1 AND ${dateFilter.sql}
       GROUP BY payment_method
       ORDER BY total_amount DESC`,
      [vendorId, ...dateFilter.params]
    );

    const totalRevenueSum = res.rows.reduce(
      (sum, row) => sum + parseFloat(row.total_amount || '0'),
      0
    );

    return res.rows.map((r) => {
      const amount = parseFloat(r.total_amount || '0');
      const percentage =
        totalRevenueSum > 0 ? Math.round((amount / totalRevenueSum) * 1000) / 10 : 0;
      return {
        paymentMethod: r.payment_method,
        totalOrders: parseInt(r.total_orders || '0', 10),
        totalAmount: amount,
        percentage,
      };
    });
  }

  /**
   * 7. Vendor Detailed Report: Product-wise Sales Breakdown
   */
  public static async getVendorProductSalesReport(
    vendorId: string,
    period: string,
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string
  ): Promise<{
    items: Array<{
      productId: string;
      productName: string;
      categoryName: string;
      sku: string;
      unitsSold: number;
      grossRevenue: number;
      averagePrice: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const prodDateFilter = buildDateFilter(period, startDate, endDate, 'o.created_at', 2);
    const offset = (page - 1) * limit;

    // Count distinct products sold
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT oi.product_id) AS count
       FROM order_management.order_items oi
       JOIN order_management.orders o ON o.id = oi.order_id
       WHERE o.vendor_id = $1 AND o.status = 'DELIVERED' AND ${prodDateFilter.sql}`,
      [vendorId, ...prodDateFilter.params]
    );

    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const itemsRes = await query<{
      product_id: string;
      product_name: string;
      category_name: string;
      sku: string;
      units_sold: string;
      gross_revenue: string;
    }>(
      `SELECT
         p.id AS product_id,
         p.name AS product_name,
         COALESCE(c.name, 'Uncategorized') AS category_name,
         p.sku,
         SUM(oi.quantity) AS units_sold,
         SUM(oi.quantity * oi.unit_price) AS gross_revenue
       FROM order_management.order_items oi
       JOIN order_management.orders o ON o.id = oi.order_id
       JOIN catalog.products p ON p.id = oi.product_id
       LEFT JOIN catalog.categories c ON c.id = p.category_id
       WHERE o.vendor_id = $1
         AND o.status = 'DELIVERED'
         AND ${prodDateFilter.sql}
       GROUP BY p.id, p.name, c.name, p.sku
       ORDER BY gross_revenue DESC
       LIMIT $${prodDateFilter.params.length + 2} OFFSET $${prodDateFilter.params.length + 3}`,
      [vendorId, ...prodDateFilter.params, limit, offset]
    );

    return {
      items: itemsRes.rows.map((r) => {
        const unitsSold = parseInt(r.units_sold || '0', 10);
        const grossRevenue = parseFloat(r.gross_revenue || '0');
        return {
          productId: r.product_id,
          productName: r.product_name,
          categoryName: r.category_name,
          sku: r.sku,
          unitsSold,
          grossRevenue,
          averagePrice: unitsSold > 0 ? Math.round((grossRevenue / unitsSold) * 100) / 100 : 0,
        };
      }),
      total,
      page,
      limit,
    };
  }

  /**
   * 8. Vendor Detailed Report: Customer-wise Sales Breakdown
   */
  public static async getVendorCustomerSalesReport(
    vendorId: string,
    period: string,
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string
  ): Promise<{
    items: Array<{
      customerId: string;
      customerName: string;
      phone: string;
      totalOrders: number;
      totalSpend: number;
      averageOrderValue: number;
      lastOrderAt: string | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const custDateFilter = buildDateFilter(period, startDate, endDate, 'o.created_at', 2);
    const offset = (page - 1) * limit;

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT o.customer_id) AS count
       FROM order_management.orders o
       WHERE o.vendor_id = $1 AND o.status = 'DELIVERED' AND ${custDateFilter.sql}`,
      [vendorId, ...custDateFilter.params]
    );

    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const itemsRes = await query<{
      customer_id: string;
      first_name: string;
      last_name: string;
      phone: string;
      total_orders: string;
      total_spend: string;
      last_order_at: string;
    }>(
      `SELECT
         u.id AS customer_id,
         u.first_name,
         u.last_name,
         u.phone,
         COUNT(o.id) AS total_orders,
         SUM(o.total_amount) AS total_spend,
         MAX(o.created_at) AS last_order_at
       FROM order_management.orders o
       JOIN identity.users u ON u.id = o.customer_id
       WHERE o.vendor_id = $1
         AND o.status = 'DELIVERED'
         AND ${custDateFilter.sql}
       GROUP BY u.id, u.first_name, u.last_name, u.phone
       ORDER BY total_spend DESC
       LIMIT $${custDateFilter.params.length + 2} OFFSET $${custDateFilter.params.length + 3}`,
      [vendorId, ...custDateFilter.params, limit, offset]
    );

    return {
      items: itemsRes.rows.map((r) => {
        const totalOrders = parseInt(r.total_orders || '0', 10);
        const totalSpend = parseFloat(r.total_spend || '0');
        return {
          customerId: r.customer_id,
          customerName: `${r.first_name} ${r.last_name}`.trim(),
          phone: r.phone,
          totalOrders,
          totalSpend,
          averageOrderValue: totalOrders > 0 ? Math.round((totalSpend / totalOrders) * 100) / 100 : 0,
          lastOrderAt: r.last_order_at || null,
        };
      }),
      total,
      page,
      limit,
    };
  }

  /**
   * 9. Vendor Detailed Report: Rider-wise Delivery Performance
   */
  public static async getVendorRiderPerformanceReport(
    vendorId: string,
    period: string,
    page: number = 1,
    limit: number = 20,
    startDate?: string,
    endDate?: string
  ): Promise<{
    items: Array<{
      riderId: string;
      riderName: string;
      phone: string;
      vehicleType: string;
      totalAssigned: number;
      completedDeliveries: number;
      failedDeliveries: number;
      avgDeliveryMinutes: number;
      completionRate: string;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const riderDateFilter = buildDateFilter(period, startDate, endDate, 'o.created_at', 2);
    const offset = (page - 1) * limit;

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(DISTINCT o.delivery_partner_id) AS count
       FROM order_management.orders o
       WHERE o.vendor_id = $1 AND o.delivery_partner_id IS NOT NULL AND ${riderDateFilter.sql}`,
      [vendorId, ...riderDateFilter.params]
    );

    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const itemsRes = await query<{
      rider_id: string;
      first_name: string;
      last_name: string;
      phone: string;
      vehicle_type: string;
      total_assigned: string;
      completed_deliveries: string;
      failed_deliveries: string;
      avg_minutes: string;
    }>(
      `SELECT
         dp.user_id AS rider_id,
         u.first_name,
         u.last_name,
         u.phone,
         COALESCE(dp.vehicle_type, 'MOTORCYCLE') AS vehicle_type,
         COUNT(o.id) AS total_assigned,
         COUNT(o.id) FILTER (WHERE o.status = 'DELIVERED') AS completed_deliveries,
         COUNT(o.id) FILTER (WHERE o.delivery_status = 'FAILED') AS failed_deliveries,
         ROUND(
           AVG(EXTRACT(EPOCH FROM (o.completed_at - o.confirmed_at)) / 60)
           FILTER (WHERE o.status = 'DELIVERED' AND o.completed_at IS NOT NULL AND o.confirmed_at IS NOT NULL),
           1
         ) AS avg_minutes
       FROM delivery.delivery_partners dp
       JOIN identity.users u ON u.id = dp.user_id
       JOIN order_management.orders o ON o.delivery_partner_id = dp.user_id
       WHERE o.vendor_id = $1 AND ${riderDateFilter.sql}
       GROUP BY dp.user_id, u.first_name, u.last_name, u.phone, dp.vehicle_type
       ORDER BY completed_deliveries DESC
       LIMIT $${riderDateFilter.params.length + 2} OFFSET $${riderDateFilter.params.length + 3}`,
      [vendorId, ...riderDateFilter.params, limit, offset]
    );

    return {
      items: itemsRes.rows.map((r) => {
        const totalAssigned = parseInt(r.total_assigned || '0', 10);
        const completedDeliveries = parseInt(r.completed_deliveries || '0', 10);
        return {
          riderId: r.rider_id,
          riderName: `${r.first_name} ${r.last_name}`.trim(),
          phone: r.phone,
          vehicleType: r.vehicle_type,
          totalAssigned,
          completedDeliveries,
          failedDeliveries: parseInt(r.failed_deliveries || '0', 10),
          avgDeliveryMinutes: parseFloat(r.avg_minutes || '0'),
          completionRate:
            totalAssigned > 0 ? ((completedDeliveries / totalAssigned) * 100).toFixed(1) + '%' : '0%',
        };
      }),
      total,
      page,
      limit,
    };
  }
}
