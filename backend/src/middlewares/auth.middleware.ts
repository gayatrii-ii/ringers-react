import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { query } from '../config/database.js';
import { AppError } from './error.middleware.js';
import { RoleCode } from '../constants/roles.js';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  phone: string;
  roles: RoleCode[];
  status: string;
}

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  phone: string;
  roles: RoleCode[];
  iat?: number;
  exp?: number;
}

// Augment Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication Middleware
 * Validates JWT access token from Authorization header (Bearer <token>)
 * Ensures user is active and exists in identity.users
 */
export async function authenticateToken(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication required. Missing Bearer token.', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw new AppError('Authentication required. Empty token provided.', 401, 'UNAUTHORIZED');
    }

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
    } catch (err: unknown) {
      if (err instanceof jwt.TokenExpiredError) {
        throw new AppError('Token has expired. Please refresh your session.', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN');
    }

    // Verify user is still active in database
    const userRes = await query<{ status: string; deleted_at: string | null }>(
      'SELECT status, deleted_at FROM identity.users WHERE id = $1',
      [decoded.sub]
    );

    const userRecord = userRes.rows[0];
    if (!userRecord || userRecord.deleted_at) {
      throw new AppError('User account not found or deleted.', 401, 'USER_NOT_FOUND');
    }

    const userStatus = userRecord.status;
    if (userStatus !== 'ACTIVE') {
      throw new AppError(
        `Your account status is ${userStatus}. Please contact support.`,
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    // Attach verified user context
    req.user = {
      userId: decoded.sub,
      email: decoded.email,
      phone: decoded.phone,
      roles: decoded.roles,
      status: userStatus,
    };

    next();
  } catch (error) {
    next(error);
  }
}
