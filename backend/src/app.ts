import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import apiRouter from './routes/index.js';
import { errorHandler, AppError } from './middlewares/error.middleware.js';
import { env } from './config/env.js';

export function createApp(): Express {
  const app: Express = express();

  // Security Headers
  app.use(helmet());

  // CORS Configuration
  app.use(
    cors({
      origin: '*', // Customize with allowed frontend domains in production
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  // Body Parsing
  app.use(
    express.json({
      limit: '10mb',
      verify: (req: any, _res: Response, buf: Buffer) => {
        req.rawBody = buf.toString('utf8');
      },
    })
  );
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Basic Request Logger for Dev Mode
  if (env.NODE_ENV === 'development') {
    app.use((req: Request, _res: Response, next: NextFunction) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
      next();
    });
  }

  // API Version 1
  app.use('/api/v1', apiRouter);

  // 404 Handler
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new AppError(`Endpoint not found: ${req.method} ${req.originalUrl}`, 404, 'NOT_FOUND'));
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
