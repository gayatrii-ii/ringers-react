import { Router } from 'express';
import { SupportController } from '../modules/support/support.controller.js';
import { authenticateToken } from '../middlewares/auth.middleware.js';
import { requireRoles } from '../middlewares/role.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { ROLES } from '../constants/roles.js';
import {
  createTicketSchema,
  resolveTicketSchema,
  listTicketsQuerySchema,
} from '../modules/support/support.validation.js';

const router = Router();

// All support routes require authentication
router.use(authenticateToken);

// User ticket operations (any authenticated user)
router.post('/tickets', validate(createTicketSchema), SupportController.createTicket);
router.get('/tickets/my', validate(listTicketsQuerySchema), SupportController.listMyTickets);
router.get('/tickets/:id', SupportController.getTicketById);

// Admin ticket management
router.get(
  '/admin/tickets',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(listTicketsQuerySchema),
  SupportController.adminListTickets
);

router.patch(
  '/admin/tickets/:id/resolve',
  requireRoles(ROLES.SUPER_ADMIN, ROLES.ADMIN),
  validate(resolveTicketSchema),
  SupportController.adminResolveTicket
);

export default router;
