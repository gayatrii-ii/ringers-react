import { Router } from 'express';
import authRoutes from './auth.routes.js';

const apiRouter = Router();

// Health Check
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    platform: 'Ringers API Service',
    timestamp: new Date().toISOString(),
  });
});

// Mount Module Routes
apiRouter.use('/auth', authRoutes);

export default apiRouter;
