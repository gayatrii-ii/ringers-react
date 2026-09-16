import { Request, Response, NextFunction } from 'express';
import { RoleCode } from '../constants/roles.js';
import { AppError } from './error.middleware.js';

/**
 * Role-Based Access Control (RBAC) Guard
 * Ensures the authenticated user possesses at least one of the specified roles.
 *
 * Example:
 * router.get('/admin-dashboard', authenticateToken, requireRoles('SUPER_ADMIN'), controller)
 * router.post('/products', authenticateToken, requireRoles('VENDOR', 'SUPER_ADMIN'), controller)
 */
export function requireRoles(...allowedRoles: RoleCode[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError('Authentication required before checking roles.', 401, 'UNAUTHORIZED')
      );
    }

    const userRoles = req.user.roles || [];

    // Check if the user has at least one of the permitted roles
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return next(
        new AppError(
          `Access forbidden. Required role: [${allowedRoles.join(', ')}]. Your roles: [${userRoles.join(', ')}].`,
          403,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
}
