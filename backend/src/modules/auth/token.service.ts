import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { query } from '../../config/database.js';
import { RoleCode } from '../../constants/roles.js';
import { AppError } from '../../middlewares/error.middleware.js';
import { AccessTokenPayload } from '../../middlewares/auth.middleware.js';

/**
 * Token Service - Manages Access Tokens and Rotated Refresh Tokens
 */
export class TokenService {
  /**
   * Hashes a token using SHA-256 for secure database lookup
   */
  private static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Sign a new short-lived JWT Access Token
   */
  public static signAccessToken(payload: {
    userId: string;
    email: string;
    phone: string;
    roles: RoleCode[];
  }): string {
    const tokenPayload: AccessTokenPayload = {
      sub: payload.userId,
      email: payload.email,
      phone: payload.phone,
      roles: payload.roles,
    };

    return jwt.sign(tokenPayload, env.JWT_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Generate an opaque, cryptographically random Refresh Token and store its hash
   */
  public static async generateRefreshToken(userId: string): Promise<string> {
    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = this.hashToken(rawToken);

    // Default 7 days expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await query(
      `INSERT INTO identity.refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    return rawToken;
  }

  /**
   * Validate and Rotate Refresh Token (implements single-use token rotation)
   */
  public static async rotateRefreshToken(rawToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; phone: string; roles: RoleCode[] };
  }> {
    const tokenHash = this.hashToken(rawToken);

    const tokenRes = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      revoked_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, revoked_at
       FROM identity.refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    );

    const record = tokenRes.rows[0];

    if (!record) {
      throw new AppError('Invalid refresh token.', 401, 'INVALID_REFRESH_TOKEN');
    }

    if (record.revoked_at) {
      // Possible token reuse attack! Revoke all tokens for this user as safety measure
      await query(
        `UPDATE identity.refresh_tokens
         SET revoked_at = CURRENT_TIMESTAMP
         WHERE user_id = $1`,
        [record.user_id]
      );
      throw new AppError(
        'Compromised refresh token reused. Session terminated for security.',
        403,
        'TOKEN_REVOKED'
      );
    }

    if (new Date(record.expires_at) < new Date()) {
      throw new AppError('Refresh token expired. Please log in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    // 1. Revoke the old token (Single use rotation)
    await query(
      `UPDATE identity.refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [record.id]
    );

    // 2. Fetch user and their current active roles
    const userRes = await query<{
      id: string;
      email: string;
      phone: string;
      status: string;
      deleted_at: Date | null;
    }>(
      `SELECT id, email, phone, status, deleted_at
       FROM identity.users
       WHERE id = $1`,
      [record.user_id]
    );

    const user = userRes.rows[0];
    if (!user || user.deleted_at || user.status !== 'ACTIVE') {
      throw new AppError('User is no longer active.', 401, 'USER_INACTIVE');
    }

    const rolesRes = await query<{ code: RoleCode }>(
      `SELECT r.code
       FROM identity.user_roles ur
       JOIN identity.roles r ON ur.role_id = r.id
       WHERE ur.user_id = $1`,
      [user.id]
    );

    const roles = rolesRes.rows.map((r) => r.code);

    // 3. Issue new pair
    const newAccessToken = this.signAccessToken({
      userId: user.id,
      email: user.email,
      phone: user.phone,
      roles,
    });

    const newRefreshToken = await this.generateRefreshToken(user.id);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        roles,
      },
    };
  }

  /**
   * Explicitly revoke a refresh token (e.g. on logout)
   */
  public static async revokeRefreshToken(rawToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawToken);
    await query(
      `UPDATE identity.refresh_tokens
       SET revoked_at = CURRENT_TIMESTAMP
       WHERE token_hash = $1`,
      [tokenHash]
    );
  }
}
