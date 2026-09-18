import { z } from 'zod';

// ─── POST /support/tickets ─────────────────────────────────────────────────
export const createTicketSchema = z.object({
  body: z.object({
    orderId: z.string().uuid('Invalid order ID format').optional().nullable(),
    category: z.enum(['ORDER_ISSUE', 'PAYMENT_ISSUE', 'DELIVERY_ISSUE', 'GENERAL']),
    subject: z.string().min(3, 'Subject must be at least 3 characters long').max(200),
    description: z.string().min(10, 'Description must be at least 10 characters long').max(2000),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  }),
});

// ─── PATCH /support/admin/tickets/:id/resolve ─────────────────────────────
export const resolveTicketSchema = z.object({
  body: z.object({
    status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED']),
    adminResponse: z.string().min(1, 'Admin response is required').max(2000),
  }),
  params: z.object({
    id: z.string().uuid('Invalid ticket ID format'),
  }),
});

// ─── GET /support/tickets (query) ─────────────────────────────────────────
export const listTicketsQuerySchema = z.object({
  query: z.object({
    category: z.enum(['ORDER_ISSUE', 'PAYMENT_ISSUE', 'DELIVERY_ISSUE', 'GENERAL']).optional(),
    status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).default('1'),
    limit: z.string().regex(/^\d+$/).transform(Number).default('20'),
  }),
});
