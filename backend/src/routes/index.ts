import { Router } from 'express';
import authRoutes from './auth.routes.js';
import vendorRoutes from './vendor.routes.js';
import categoryRoutes from './category.routes.js';
import productRoutes from './product.routes.js';
import adminRoutes from './admin.routes.js';
import publicRoutes from './public.routes.js';
import customerRoutes from './customer.routes.js';
import deliveryRoutes from './delivery.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes, { walletRouter } from './payment.routes.js';
import notificationRoutes from './notification.routes.js';
import reviewRoutes from './review.routes.js';
import analyticsRoutes from './analytics.routes.js';
import supportRoutes from './support.routes.js';

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
apiRouter.use('/vendors', vendorRoutes);
apiRouter.use('/categories', categoryRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/admin', adminRoutes);
apiRouter.use('/public', publicRoutes);
apiRouter.use('/customers', customerRoutes);
apiRouter.use('/delivery', deliveryRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/payments', paymentRoutes);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/notifications', notificationRoutes);
apiRouter.use('/reviews', reviewRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/support', supportRoutes);

export default apiRouter;

