import crypto from 'crypto';
import { query, withTransaction } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES, RoleCode } from '../../constants/roles.js';

export interface OrderItemInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

export interface CalculatedItem {
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  quantity: number;
  regularPrice: number;
  unitPrice: number;
  discountPerUnit: number;
  taxRatePercent: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface OrderCalculationResult {
  vendorId: string;
  vendorName: string;
  customerAddress: {
    addressId: string;
    addressType: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
  };
  distanceKm: number | null;
  items: CalculatedItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  customerId: string;
  vendorId: string;
  vendorName?: string;
  status: string;
  paymentStatus: string;
  deliveryStatus: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  deliveryFee: number;
  totalAmount: number;
  shippingAddressSnapshot: any;
  items?: any[];
  statusHistory?: any[];
  placedAt: Date;
  confirmedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class OrderService {
  /**
   * Calculate Haversine distance in kilometers between two GPS coordinate pairs
   */
  public static calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's mean radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c * 100) / 100;
  }

  /**
   * Generate human-readable, collision-proof order number: RNG-ORD-YYYYMMDD-XXXXXX
   */
  public static generateOrderNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    return `RNG-ORD-${today}-${randomSuffix}`;
  }

  /**
   * Cart & Price Calculation Engine
   * Validates vendor, products, customer address, computes GST taxes and delivery distance fee.
   */
  public static async calculateOrder(
    customerId: string,
    vendorId: string,
    addressId: string,
    items: OrderItemInput[]
  ): Promise<OrderCalculationResult> {
    // 1. Verify Vendor exists & is ACTIVE
    const vendorRes = await query(
      `SELECT v.id, v.business_name, v.status,
              va.latitude AS vendor_lat, va.longitude AS vendor_lon
       FROM vendor.vendors v
       LEFT JOIN vendor.vendor_addresses va ON va.vendor_id = v.id AND va.is_primary = TRUE
       WHERE v.id = $1 AND v.deleted_at IS NULL`,
      [vendorId]
    );

    if (vendorRes.rows.length === 0) {
      throw new AppError('Vendor store not found', 404, 'VENDOR_NOT_FOUND');
    }

    const vendor = vendorRes.rows[0];
    if (!vendor) {
      throw new AppError('Vendor store not found', 404, 'VENDOR_NOT_FOUND');
    }
    if (vendor.status !== 'ACTIVE') {
      throw new AppError(`Vendor store is currently ${vendor.status.toLowerCase()} and cannot accept orders`, 400, 'VENDOR_NOT_ACTIVE');
    }

    // 2. Verify Customer Delivery Address
    const addressRes = await query(
      `SELECT id, address_type, address_line_1, address_line_2, city, state, postal_code, latitude, longitude
       FROM customer.addresses
       WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [addressId, customerId]
    );

    if (addressRes.rows.length === 0) {
      throw new AppError('Selected delivery address not found', 404, 'ADDRESS_NOT_FOUND');
    }

    const address = addressRes.rows[0];
    if (!address) {
      throw new AppError('Selected delivery address not found', 404, 'ADDRESS_NOT_FOUND');
    }

    // 3. Compute Distance & Delivery Fee
    let distanceKm: number | null = null;
    let deliveryFee = 40.0; // Default nominal delivery fee

    const custLat = address.latitude ? parseFloat(address.latitude) : null;
    const custLon = address.longitude ? parseFloat(address.longitude) : null;
    const vendLat = vendor.vendor_lat ? parseFloat(vendor.vendor_lat) : null;
    const vendLon = vendor.vendor_lon ? parseFloat(vendor.vendor_lon) : null;

    if (custLat !== null && custLon !== null && vendLat !== null && vendLon !== null) {
      distanceKm = OrderService.calculateDistanceKm(vendLat, vendLon, custLat, custLon);

      if (distanceKm > 25) {
        throw new AppError(
          `Delivery address is ${distanceKm} km away. Maximum delivery radius is 25 km.`,
          400,
          'DISTANCE_EXCEEDED'
        );
      }

      // Base fee ₹30 for first 2 km, + ₹10 per additional km
      if (distanceKm <= 2) {
        deliveryFee = 30.0;
      } else {
        deliveryFee = Math.round((30.0 + (distanceKm - 2) * 10.0) * 100) / 100;
      }
    }

    // 4. Batch query catalog products
    const productIds = items.map((i) => i.productId);
    const prodRes = await query(
      `SELECT id, vendor_id, name, price, discount_price, tax_rate, status
       FROM catalog.products
       WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [productIds]
    );

    const productMap = new Map<string, any>();
    for (const p of prodRes.rows) {
      productMap.set(p.id, p);
    }

    // 5. Query variants if any requested
    const variantIds = items.map((i) => i.variantId).filter(Boolean);
    const variantMap = new Map<string, any>();
    if (variantIds.length > 0) {
      const varRes = await query(
        `SELECT id, product_id, name, price, status
         FROM catalog.product_variants
         WHERE id = ANY($1::uuid[])`,
        [variantIds]
      );
      for (const v of varRes.rows) {
        variantMap.set(v.id, v);
      }
    }

    // 6. Calculate Line Items
    const calculatedItems: CalculatedItem[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let itemCount = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(`Product with ID ${item.productId} not found`, 404, 'PRODUCT_NOT_FOUND');
      }

      if (product.vendor_id !== vendorId) {
        throw new AppError(`Product "${product.name}" does not belong to this vendor store`, 400, 'VENDOR_PRODUCT_MISMATCH');
      }

      if (product.status !== 'AVAILABLE') {
        throw new AppError(`Product "${product.name}" is currently ${product.status.toLowerCase()}`, 400, 'PRODUCT_UNAVAILABLE');
      }

      const regularPrice = parseFloat(product.price);
      let effectiveUnitPrice = regularPrice;
      let discountPerUnit = 0;
      let variantName: string | null = null;

      // Check variant pricing
      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.product_id !== product.id) {
          throw new AppError(`Variant not found for product "${product.name}"`, 404, 'VARIANT_NOT_FOUND');
        }
        if (variant.status !== 'AVAILABLE') {
          throw new AppError(`Variant "${variant.name}" for "${product.name}" is out of stock`, 400, 'VARIANT_UNAVAILABLE');
        }
        effectiveUnitPrice = parseFloat(variant.price);
        variantName = variant.name;
      } else if (product.discount_price !== null && parseFloat(product.discount_price) < regularPrice) {
        effectiveUnitPrice = parseFloat(product.discount_price);
        discountPerUnit = regularPrice - effectiveUnitPrice;
      }

      const taxRate = parseFloat(product.tax_rate || '0');
      const lineSubtotal = Math.round(effectiveUnitPrice * item.quantity * 100) / 100;
      const lineDiscount = Math.round(discountPerUnit * item.quantity * 100) / 100;
      const lineTax = Math.round(((lineSubtotal * taxRate) / 100) * 100) / 100;
      const lineTotal = Math.round((lineSubtotal + lineTax) * 100) / 100;

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      totalTax += lineTax;
      itemCount += item.quantity;

      calculatedItems.push({
        productId: product.id,
        variantId: item.variantId || null,
        productName: product.name,
        variantName,
        quantity: item.quantity,
        regularPrice,
        unitPrice: effectiveUnitPrice,
        discountPerUnit,
        taxRatePercent: taxRate,
        lineSubtotal,
        lineDiscount,
        lineTax,
        lineTotal,
      });
    }

    subtotal = Math.round(subtotal * 100) / 100;
    totalDiscount = Math.round(totalDiscount * 100) / 100;
    totalTax = Math.round(totalTax * 100) / 100;
    const grandTotal = Math.round((subtotal + totalTax + deliveryFee) * 100) / 100;

    return {
      vendorId: vendor.id,
      vendorName: vendor.business_name,
      customerAddress: {
        addressId: address.id,
        addressType: address.address_type,
        addressLine1: address.address_line_1,
        addressLine2: address.address_line_2,
        city: address.city,
        state: address.state,
        postalCode: address.postal_code,
        latitude: custLat,
        longitude: custLon,
      },
      distanceKm,
      items: calculatedItems,
      itemCount,
      subtotal,
      discountAmount: totalDiscount,
      taxAmount: totalTax,
      deliveryFee,
      totalAmount: grandTotal,
    };
  }

  /**
   * Order Placement with Immutable Snapshots
   * Atomically creates orders, order_items, and order_status_history rows in a single transaction.
   */
  public static async createOrder(
    customerId: string,
    data: {
      vendorId: string;
      addressId: string;
      items: OrderItemInput[];
      customerNotes?: string | null;
    }
  ): Promise<OrderResponse> {
    // 1. Run price calculation engine first
    const calculation = await OrderService.calculateOrder(customerId, data.vendorId, data.addressId, data.items);

    // 2. Fetch customer details for shipping snapshot
    const custRes = await query(
      `SELECT first_name, last_name, phone, email FROM identity.users WHERE id = $1`,
      [customerId]
    );
    const customer = custRes.rows[0];
    if (!customer) {
      throw new AppError('Customer user not found', 404, 'USER_NOT_FOUND');
    }

    const shippingAddressSnapshot = {
      addressId: calculation.customerAddress.addressId,
      addressType: calculation.customerAddress.addressType,
      recipientName: `${customer.first_name} ${customer.last_name}`.trim(),
      recipientPhone: customer.phone,
      recipientEmail: customer.email,
      addressLine1: calculation.customerAddress.addressLine1,
      addressLine2: calculation.customerAddress.addressLine2,
      city: calculation.customerAddress.city,
      state: calculation.customerAddress.state,
      postalCode: calculation.customerAddress.postalCode,
      latitude: calculation.customerAddress.latitude,
      longitude: calculation.customerAddress.longitude,
      customerNotes: data.customerNotes || null,
      placedAt: new Date().toISOString(),
    };

    const orderNumber = OrderService.generateOrderNumber();

    // 3. Execute atomic transaction
    return await withTransaction(async (client) => {
      // Insert order
      const orderInsertRes = await client.query(
        `INSERT INTO order_management.orders (
           order_number,
           customer_id,
           vendor_id,
           status,
           payment_status,
           delivery_status,
           subtotal,
           discount_amount,
           tax_amount,
           delivery_fee,
           total_amount,
           shipping_address_snapshot
         ) VALUES ($1, $2, $3, 'PENDING', 'PENDING', 'UNASSIGNED', $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          orderNumber,
          customerId,
          data.vendorId,
          calculation.subtotal,
          calculation.discountAmount,
          calculation.taxAmount,
          calculation.deliveryFee,
          calculation.totalAmount,
          JSON.stringify(shippingAddressSnapshot),
        ]
      );

      const order = orderInsertRes.rows[0];

      // Insert order items
      const createdItems: any[] = [];
      for (const item of calculation.items) {
        const itemInsertRes = await client.query(
          `INSERT INTO order_management.order_items (
             order_id,
             product_id,
             product_name_snapshot,
             quantity,
             unit_price,
             discount_amount,
             tax_amount,
             total_amount
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            order.id,
            item.productId,
            item.variantName ? `${item.productName} (${item.variantName})` : item.productName,
            item.quantity,
            item.unitPrice,
            item.lineDiscount,
            item.lineTax,
            item.lineTotal,
          ]
        );
        createdItems.push(itemInsertRes.rows[0]);
      }

      // Record initial state in order_status_history
      await client.query(
        `INSERT INTO order_management.order_status_history (
           order_id,
           old_status,
           new_status,
           changed_by,
           reason
         ) VALUES ($1, NULL, 'PENDING', $2, 'Order placed by customer')`,
        [order.id, customerId]
      );

      return OrderService.mapOrderResponse(order, createdItems);
    });
  }

  /**
   * Order Lifecycle State Machine
   * Enforces strict transition hierarchy:
   * PENDING -> CONFIRMED -> PREPARING -> READY -> OUT_FOR_DELIVERY -> DELIVERED (or CANCELLED)
   */
  public static async updateOrderStatus(
    orderId: string,
    newStatus: string,
    userId: string,
    userRoles: RoleCode[],
    reason?: string | null
  ): Promise<OrderResponse> {
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      PENDING: ['CONFIRMED', 'CANCELLED'],
      CONFIRMED: ['PREPARING', 'CANCELLED'],
      PREPARING: ['READY'],
      READY: ['OUT_FOR_DELIVERY', 'CANCELLED'],
      OUT_FOR_DELIVERY: ['DELIVERED'],
      DELIVERED: [],
      CANCELLED: [],
    };

    return await withTransaction(async (client) => {
      // 1. Fetch order with row-level lock
      const orderRes = await client.query(
        `SELECT o.*, v.owner_user_id AS vendor_owner_id
         FROM order_management.orders o
         JOIN vendor.vendors v ON v.id = o.vendor_id
         WHERE o.id = $1 FOR UPDATE`,
        [orderId]
      );

      if (orderRes.rows.length === 0) {
        throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
      }

      const order = orderRes.rows[0];
      const currentStatus = order.status;

      // 2. Validate transition validity
      const allowedNext = ALLOWED_TRANSITIONS[currentStatus] || [];
      if (!allowedNext.includes(newStatus)) {
        throw new AppError(
          `Cannot transition order from status "${currentStatus}" to "${newStatus}". Allowed next: [${allowedNext.join(', ')}]`,
          400,
          'INVALID_STATUS_TRANSITION'
        );
      }

      // 3. Enforce Role Permissions for each transition
      const isSuperAdmin = userRoles.includes(ROLES.SUPER_ADMIN) || userRoles.includes(ROLES.ADMIN);
      const isVendorOwner = order.vendor_owner_id === userId;
      const isCustomer = order.customer_id === userId;
      const isDeliveryBoy = userRoles.includes(ROLES.DELIVERY_BOY);

      if (!isSuperAdmin) {
        if (newStatus === 'CONFIRMED' || newStatus === 'PREPARING' || newStatus === 'READY') {
          if (!isVendorOwner) {
            throw new AppError('Only the assigned vendor or administrator can confirm and prepare orders', 403, 'FORBIDDEN');
          }
        } else if (newStatus === 'OUT_FOR_DELIVERY' || newStatus === 'DELIVERED') {
          if (!isDeliveryBoy) {
            throw new AppError('Only the delivery partner or administrator can mark orders out for delivery or delivered', 403, 'FORBIDDEN');
          }
        } else if (newStatus === 'CANCELLED') {
          if (isCustomer && currentStatus !== 'PENDING') {
            throw new AppError('Customers can only cancel orders while in PENDING status', 400, 'CANNOT_CANCEL_ACTIVE_ORDER');
          }
          if (!isCustomer && !isVendorOwner) {
            throw new AppError('You are not authorized to cancel this order', 403, 'FORBIDDEN');
          }
        }
      }

      // 4. Update timestamps based on transition
      const timestampUpdates: string[] = [];
      if (newStatus === 'CONFIRMED') timestampUpdates.push('confirmed_at = CURRENT_TIMESTAMP');
      if (newStatus === 'DELIVERED') timestampUpdates.push('completed_at = CURRENT_TIMESTAMP');
      if (newStatus === 'CANCELLED') timestampUpdates.push('cancelled_at = CURRENT_TIMESTAMP');

      // Update delivery_status sync
      let deliveryStatusUpdate = '';
      if (newStatus === 'OUT_FOR_DELIVERY') deliveryStatusUpdate = `, delivery_status = 'PICKED_UP'`;
      if (newStatus === 'DELIVERED') deliveryStatusUpdate = `, delivery_status = 'DELIVERED'`;
      if (newStatus === 'CANCELLED') deliveryStatusUpdate = `, delivery_status = 'FAILED'`;

      const setClause = [
        'status = $1',
        'updated_at = CURRENT_TIMESTAMP',
        ...timestampUpdates,
      ].join(', ');

      const updatedOrderRes = await client.query(
        `UPDATE order_management.orders 
         SET ${setClause} ${deliveryStatusUpdate}
         WHERE id = $2 
         RETURNING *`,
        [newStatus, orderId]
      );

      // 5. Audit log in order_status_history
      await client.query(
        `INSERT INTO order_management.order_status_history (
           order_id,
           old_status,
           new_status,
           changed_by,
           reason
         ) VALUES ($1, $2, $3, $4, $5)`,
        [orderId, currentStatus, newStatus, userId, reason || `Transitioned to ${newStatus}`]
      );

      return OrderService.mapOrderResponse(updatedOrderRes.rows[0]);
    });
  }

  /**
   * Customer-specific order cancellation
   */
  public static async cancelOrder(
    orderId: string,
    userId: string,
    userRoles: RoleCode[],
    reason: string
  ): Promise<OrderResponse> {
    return await OrderService.updateOrderStatus(orderId, 'CANCELLED', userId, userRoles, reason);
  }

  /**
   * Get single order by ID with items, status history, and role-based access scoping
   */
  public static async getOrderById(
    orderId: string,
    userId: string,
    userRoles: RoleCode[]
  ): Promise<OrderResponse> {
    const isSuperAdmin = userRoles.includes(ROLES.SUPER_ADMIN) || userRoles.includes(ROLES.ADMIN);

    const orderRes = await query(
      `SELECT o.*, v.business_name AS vendor_name, v.owner_user_id AS vendor_owner_id
       FROM order_management.orders o
       JOIN vendor.vendors v ON v.id = o.vendor_id
       WHERE o.id = $1`,
      [orderId]
    );

    if (orderRes.rows.length === 0) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    const order = orderRes.rows[0];
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    // Access control check
    if (!isSuperAdmin) {
      const isCustomer = order.customer_id === userId;
      const isVendor = order.vendor_owner_id === userId;
      // Also allow if rider is assigned
      const riderRes = await query(
        `SELECT id FROM delivery.delivery_assignments WHERE order_id = $1 AND delivery_boy_id = $2`,
        [orderId, userId]
      );
      const isAssignedRider = riderRes.rows.length > 0;

      if (!isCustomer && !isVendor && !isAssignedRider) {
        throw new AppError('You do not have access to view this order', 403, 'FORBIDDEN');
      }
    }

    // Fetch order items
    const itemsRes = await query(
      `SELECT * FROM order_management.order_items WHERE order_id = $1 ORDER BY created_at ASC`,
      [orderId]
    );

    // Fetch order history
    const historyRes = await query(
      `SELECT h.*, u.first_name, u.last_name
       FROM order_management.order_status_history h
       LEFT JOIN identity.users u ON u.id = h.changed_by
       WHERE h.order_id = $1
       ORDER BY h.created_at ASC`,
      [orderId]
    );

    return OrderService.mapOrderResponse(order, itemsRes.rows, historyRes.rows);
  }

  /**
   * Customer: List past & active orders
   */
  public static async listCustomerOrders(
    customerId: string,
    filter: { status?: string; page?: number; limit?: number }
  ): Promise<{ orders: OrderResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['o.customer_id = $1'];
    const params: unknown[] = [customerId];
    let pIdx = 2;

    if (filter.status) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(filter.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM order_management.orders o ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(limit);
    params.push(offset);

    const ordersRes = await query(
      `SELECT o.*, v.business_name AS vendor_name
       FROM order_management.orders o
       JOIN vendor.vendors v ON v.id = o.vendor_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    return {
      orders: ordersRes.rows.map((r) => OrderService.mapOrderResponse(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Vendor: Live Orders Desk (orders awaiting acceptance, in prep, ready)
   */
  public static async listVendorOrders(
    vendorOwnerUserId: string,
    filter: { status?: string; page?: number; limit?: number }
  ): Promise<{ orders: OrderResponse[]; total: number; page: number; limit: number }> {
    // Resolve vendor store ID owned by caller
    const vendRes = await query(
      `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 AND deleted_at IS NULL`,
      [vendorOwnerUserId]
    );

    if (vendRes.rows.length === 0 || !vendRes.rows[0]) {
      throw new AppError('Vendor store not found for caller', 404, 'VENDOR_NOT_FOUND');
    }

    const vendorId = vendRes.rows[0].id;
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['o.vendor_id = $1'];
    const params: unknown[] = [vendorId];
    let pIdx = 2;

    if (filter.status) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(filter.status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM order_management.orders o ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(limit);
    params.push(offset);

    const ordersRes = await query(
      `SELECT o.*
       FROM order_management.orders o
       ${whereClause}
       ORDER BY 
         CASE o.status 
           WHEN 'PENDING' THEN 1 
           WHEN 'CONFIRMED' THEN 2 
           WHEN 'PREPARING' THEN 3 
           WHEN 'READY' THEN 4 
           ELSE 5 
         END,
         o.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    return {
      orders: ordersRes.rows.map((r) => OrderService.mapOrderResponse(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Super Admin / Operations: Global Order Monitor with filters
   */
  public static async listAdminOrders(filter: {
    status?: string;
    paymentStatus?: string;
    deliveryStatus?: string;
    vendorId?: string;
    customerId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ orders: OrderResponse[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.min(100, Math.max(1, filter.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: unknown[] = [];
    let pIdx = 1;

    if (filter.status) {
      conditions.push(`o.status = $${pIdx++}`);
      params.push(filter.status);
    }
    if (filter.paymentStatus) {
      conditions.push(`o.payment_status = $${pIdx++}`);
      params.push(filter.paymentStatus);
    }
    if (filter.deliveryStatus) {
      conditions.push(`o.delivery_status = $${pIdx++}`);
      params.push(filter.deliveryStatus);
    }
    if (filter.vendorId) {
      conditions.push(`o.vendor_id = $${pIdx++}`);
      params.push(filter.vendorId);
    }
    if (filter.customerId) {
      conditions.push(`o.customer_id = $${pIdx++}`);
      params.push(filter.customerId);
    }
    if (filter.startDate) {
      conditions.push(`o.created_at >= $${pIdx++}::timestamptz`);
      params.push(`${filter.startDate} 00:00:00Z`);
    }
    if (filter.endDate) {
      conditions.push(`o.created_at <= $${pIdx++}::timestamptz`);
      params.push(`${filter.endDate} 23:59:59Z`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM order_management.orders o ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    params.push(limit);
    params.push(offset);

    const ordersRes = await query(
      `SELECT o.*, v.business_name AS vendor_name
       FROM order_management.orders o
       JOIN vendor.vendors v ON v.id = o.vendor_id
       ${whereClause}
       ORDER BY o.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      params
    );

    return {
      orders: ordersRes.rows.map((r) => OrderService.mapOrderResponse(r)),
      total,
      page,
      limit,
    };
  }

  /**
   * Helper to serialize DB row to OrderResponse
   */
  private static mapOrderResponse(row: any, items?: any[], history?: any[]): OrderResponse {
    return {
      id: row.id,
      orderNumber: row.order_number,
      customerId: row.customer_id,
      vendorId: row.vendor_id,
      vendorName: row.vendor_name || undefined,
      status: row.status,
      paymentStatus: row.payment_status,
      deliveryStatus: row.delivery_status,
      subtotal: parseFloat(row.subtotal),
      discountAmount: parseFloat(row.discount_amount),
      taxAmount: parseFloat(row.tax_amount),
      deliveryFee: parseFloat(row.delivery_fee),
      totalAmount: parseFloat(row.total_amount),
      shippingAddressSnapshot:
        typeof row.shipping_address_snapshot === 'string'
          ? JSON.parse(row.shipping_address_snapshot)
          : row.shipping_address_snapshot,
      items: items?.map((i) => ({
        id: i.id,
        productId: i.product_id,
        productName: i.product_name_snapshot,
        quantity: i.quantity,
        unitPrice: parseFloat(i.unit_price),
        discountAmount: parseFloat(i.discount_amount),
        taxAmount: parseFloat(i.tax_amount),
        totalAmount: parseFloat(i.total_amount),
      })),
      statusHistory: history?.map((h) => ({
        id: h.id,
        oldStatus: h.old_status,
        newStatus: h.new_status,
        changedBy: h.changed_by,
        changedByName: h.first_name ? `${h.first_name} ${h.last_name || ''}`.trim() : null,
        reason: h.reason,
        createdAt: h.created_at,
      })),
      placedAt: row.placed_at,
      confirmedAt: row.confirmed_at || null,
      completedAt: row.completed_at || null,
      cancelledAt: row.cancelled_at || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
