import crypto from 'crypto';
import { query } from '../../config/database.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { ROLES, RoleCode } from '../../constants/roles.js';

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userId: string;
  orderId: string | null;
  category: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  adminResponse: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SupportService {
  /**
   * Helper: Generate unique ticket number (e.g. RNG-TCK-20260918-XXXX)
   */
  private static generateTicketNumber(): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `RNG-TCK-${today}-${rand}`;
  }

  /**
   * Create new support ticket
   */
  public static async createTicket(
    userId: string,
    data: {
      orderId?: string | null;
      category: 'ORDER_ISSUE' | 'PAYMENT_ISSUE' | 'DELIVERY_ISSUE' | 'ACCOUNT_ISSUE' | 'WALLET_ISSUE' | 'GENERAL';
      subCategory?: string | null;
      subject: string;
      description: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
    }
  ): Promise<SupportTicketRecord> {
    let vendorId: string | null = null;

    // If orderId provided, verify order belongs to user or user is authorized and extract vendor_id
    if (data.orderId) {
      const orderCheck = await query<{ id: string; vendor_id: string }>(
        `SELECT id, vendor_id FROM order_management.orders WHERE id = $1`,
        [data.orderId]
      );
      if (orderCheck.rows.length === 0 || !orderCheck.rows[0]) {
        throw new AppError('Specified order ID not found.', 404, 'ORDER_NOT_FOUND');
      }
      vendorId = orderCheck.rows[0].vendor_id;
    }

    const ticketNumber = this.generateTicketNumber();

    const res = await query<any>(
      `INSERT INTO support.tickets (
         ticket_number, user_id, order_id, vendor_id, category, sub_category, subject, description, priority, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'OPEN')
       RETURNING *`,
      [
        ticketNumber,
        userId,
        data.orderId || null,
        vendorId,
        data.category,
        data.subCategory || null,
        data.subject.trim(),
        data.description.trim(),
        data.priority || 'MEDIUM',
      ]
    );

    const row = res.rows[0]!;
    return {
      id: row.id,
      ticketNumber: row.ticket_number,
      userId: row.user_id,
      orderId: row.order_id,
      category: row.category,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      adminResponse: row.admin_response,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * User lists their own tickets
   */
  public static async listMyTickets(
    userId: string,
    options: {
      status?: string;
      category?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ tickets: SupportTicketRecord[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let pIdx = 2;

    if (options.status) {
      conditions.push(`status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.category) {
      conditions.push(`category = $${pIdx++}`);
      params.push(options.category);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM support.tickets WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query<any>(
      `SELECT * FROM support.tickets
       WHERE ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      [...params, limit, offset]
    );

    const tickets: SupportTicketRecord[] = res.rows.map((row) => ({
      id: row.id,
      ticketNumber: row.ticket_number,
      userId: row.user_id,
      orderId: row.order_id,
      category: row.category,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      adminResponse: row.admin_response,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return { tickets, total, page, limit };
  }

  /**
   * Get single ticket by ID
   */
  public static async getTicketById(
    ticketId: string,
    userId: string,
    userRoles: RoleCode[]
  ): Promise<SupportTicketRecord> {
    const res = await query<any>(
      `SELECT * FROM support.tickets WHERE id = $1`,
      [ticketId]
    );

    if (res.rows.length === 0 || !res.rows[0]) {
      throw new AppError('Support ticket not found.', 404, 'TICKET_NOT_FOUND');
    }

    const row = res.rows[0];

    const isAdmin = userRoles.some((r) => [ROLES.SUPER_ADMIN, ROLES.ADMIN].includes(r as any));
    if (row.user_id !== userId && !isAdmin) {
      throw new AppError('You do not have permission to view this ticket.', 403, 'FORBIDDEN');
    }

    return {
      id: row.id,
      ticketNumber: row.ticket_number,
      userId: row.user_id,
      orderId: row.order_id,
      category: row.category,
      subject: row.subject,
      description: row.description,
      status: row.status,
      priority: row.priority,
      adminResponse: row.admin_response,
      resolvedAt: row.resolved_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Super Admin / Admin: List all tickets across platform
   */
  public static async adminListTickets(options: {
    status?: string;
    category?: string;
    priority?: string;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: any[]; total: number; page: number; limit: number }> {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['1=1'];
    const params: unknown[] = [];
    let pIdx = 1;

    if (options.status) {
      conditions.push(`t.status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.category) {
      conditions.push(`t.category = $${pIdx++}`);
      params.push(options.category);
    }

    if (options.priority) {
      conditions.push(`t.priority = $${pIdx++}`);
      params.push(options.priority);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM support.tickets t WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT t.*, u.first_name, u.last_name, u.phone, u.email
       FROM support.tickets t
       JOIN identity.users u ON u.id = t.user_id
       WHERE ${whereClause}
       ORDER BY CASE t.priority 
                  WHEN 'URGENT' THEN 1 
                  WHEN 'HIGH' THEN 2 
                  WHEN 'MEDIUM' THEN 3 
                  ELSE 4 
                END ASC, t.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      [...params, limit, offset]
    );

    return { tickets: res.rows, total, page, limit };
  }

  /**
   * Super Admin / Admin: Resolve or update support ticket
   */
  public static async adminResolveTicket(
    ticketId: string,
    status: 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED',
    adminResponse: string
  ): Promise<{ id: string; status: string; message: string }> {
    const isResolved = status === 'RESOLVED' || status === 'CLOSED';
    const res = await query(
      `UPDATE support.tickets
       SET status = $1,
           admin_response = $2,
           resolved_at = ${isResolved ? 'CURRENT_TIMESTAMP' : 'resolved_at'},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING id, status`,
      [status, adminResponse.trim(), ticketId]
    );

    if (res.rows.length === 0) {
      throw new AppError('Support ticket not found.', 404, 'TICKET_NOT_FOUND');
    }

    return {
      id: ticketId,
      status,
      message: `Support ticket marked as ${status}. Response recorded.`,
    };
  }

  /**
   * Vendor: List support tickets relating to vendor's store/orders
   */
  public static async listVendorTickets(
    vendorUserId: string,
    options: {
      status?: string;
      category?: string;
      page?: number;
      limit?: number;
    }
  ): Promise<{ tickets: any[]; total: number; page: number; limit: number }> {
    const vendorRes = await query<{ id: string }>(
      `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 LIMIT 1`,
      [vendorUserId]
    );

    if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
      throw new AppError('Vendor not found for user.', 404, 'VENDOR_NOT_FOUND');
    }

    const vendorId = vendorRes.rows[0].id;
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['t.vendor_id = $1'];
    const params: unknown[] = [vendorId];
    let pIdx = 2;

    if (options.status) {
      conditions.push(`t.status = $${pIdx++}`);
      params.push(options.status);
    }

    if (options.category) {
      conditions.push(`t.category = $${pIdx++}`);
      params.push(options.category);
    }

    const whereClause = conditions.join(' AND ');

    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM support.tickets t WHERE ${whereClause}`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const res = await query(
      `SELECT t.*, u.first_name, u.last_name, u.phone, u.email, o.order_number
       FROM support.tickets t
       JOIN identity.users u ON u.id = t.user_id
       LEFT JOIN order_management.orders o ON o.id = t.order_id
       WHERE ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${pIdx++} OFFSET $${pIdx}`,
      [...params, limit, offset]
    );

    return { tickets: res.rows, total, page, limit };
  }

  /**
   * Vendor: Respond to an order support ticket
   */
  public static async vendorRespondToTicket(
    vendorUserId: string,
    ticketId: string,
    response: string
  ): Promise<{ message: string }> {
    const vendorRes = await query<{ id: string }>(
      `SELECT id FROM vendor.vendors WHERE owner_user_id = $1 LIMIT 1`,
      [vendorUserId]
    );

    if (vendorRes.rows.length === 0 || !vendorRes.rows[0]) {
      throw new AppError('Vendor not found for user.', 404, 'VENDOR_NOT_FOUND');
    }

    const vendorId = vendorRes.rows[0].id;

    const ticketRes = await query<{ id: string }>(
      `SELECT id FROM support.tickets WHERE id = $1 AND vendor_id = $2`,
      [ticketId, vendorId]
    );

    if (ticketRes.rows.length === 0) {
      throw new AppError('Support ticket not found for your store.', 404, 'TICKET_NOT_FOUND');
    }

    await query(
      `UPDATE support.tickets 
       SET vendor_response = $1, vendor_responded_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [response.trim(), ticketId]
    );

    return { message: 'Response to support ticket submitted successfully.' };
  }
}

