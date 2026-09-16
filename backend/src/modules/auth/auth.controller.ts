import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service.js';
import { TokenService } from './token.service.js';
import { AppError } from '../../middlewares/error.middleware.js';

export class AuthController {
  /**
   * Universal Login (All roles: Super Admin, Vendor, Delivery Boy, Customer)
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password } = req.body;
      const result = await AuthService.login(identifier, password);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Vendor Registration with Private Registration Key
   */
  public static async registerVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.registerVendorWithPrivateKey(req.body);

      res.status(201).json({
        success: true,
        message: 'Vendor registered and activated successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Send OTP to Phone
   */
  public static async sendOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, purpose } = req.body;
      const result = await AuthService.sendOtp(phone, purpose);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          expiresInSeconds: result.expiresInSeconds,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify OTP
   */
  public static async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, otpCode, purpose } = req.body;
      await AuthService.verifyOtp(phone, otpCode, purpose);

      res.status(200).json({
        success: true,
        message: 'OTP verified successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Rotate Refresh Token and generate new Access Token
   */
  public static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await TokenService.rotateRefreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout user and revoke refresh token
   */
  public static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await TokenService.revokeRefreshToken(refreshToken);
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get Current Authenticated User Context
   */
  public static async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Unauthorized', 401, 'UNAUTHORIZED');
      }

      res.status(200).json({
        success: true,
        data: req.user,
      });
    } catch (error) {
      next(error);
    }
  }
}
