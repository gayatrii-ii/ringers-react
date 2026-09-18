import { Request, Response, NextFunction } from 'express';
import { SupportService } from './support.service.js';

export class SupportController {
  /**
   * Create new support ticket
   */
  public static async createTicket(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await SupportService.createTicket(user.userId, req.body);
      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * User lists their tickets
   */
  public static async listMyTickets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = (req as any).user;
      const result = await SupportService.listMyTickets(user.userId, req.query as any);
      res.status(200).json({
        success: true,
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single ticket detail
   */
  public static async getTicketById(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const user = (req as any).user;
      const result = await SupportService.getTicketById(id, user.userId, user.roles);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: List all tickets
   */
  public static async adminListTickets(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const result = await SupportService.adminListTickets(req.query as any);
      res.status(200).json({
        success: true,
        data: result.tickets,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
          totalPages: Math.ceil(result.total / result.limit),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: Resolve ticket
   */
  public static async adminResolveTicket(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const { status, adminResponse } = req.body;
      const result = await SupportService.adminResolveTicket(id, status, adminResponse);
      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}
