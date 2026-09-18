import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from './env.js';
import { RoleCode, ROLES } from '../constants/roles.js';

export interface AuthenticatedSocketUser {
  userId: string;
  email: string;
  phone: string;
  roles: RoleCode[];
  vendorId?: string;
}

export interface CustomSocket extends Socket {
  user?: AuthenticatedSocketUser;
}

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server with JWT-based connection authentication
 */
export function initSocketServer(server: HttpServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // JWT Authentication Middleware for WebSocket handshakes
  io.use((socket: CustomSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization
          ? socket.handshake.headers.authorization.replace('Bearer ', '')
          : null);

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as {
        sub: string;
        email: string;
        phone: string;
        roles: RoleCode[];
        vendorId?: string;
      };

      socket.user = {
        userId: decoded.sub,
        email: decoded.email,
        phone: decoded.phone,
        roles: decoded.roles,
        vendorId: decoded.vendorId,
      };

      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket: CustomSocket) => {
    const user = socket.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    // Join user-specific private room
    socket.join(`user:${user.userId}`);

    // Join role-specific broadcast rooms
    if (user.roles.includes(ROLES.CUSTOMER)) {
      socket.join(`customer:${user.userId}`);
    }

    if (user.roles.includes(ROLES.DELIVERY_BOY)) {
      socket.join(`rider:${user.userId}`);
    }

    if (user.roles.includes(ROLES.VENDOR)) {
      if (user.vendorId) {
        socket.join(`vendor:${user.vendorId}`);
      }
      socket.join(`vendor_user:${user.userId}`);
    }

    if (user.roles.includes(ROLES.SUPER_ADMIN) || user.roles.includes(ROLES.ADMIN)) {
      socket.join('admin');
    }

    // Allow client to join an active order room for tracking
    socket.on('join:order', (orderId: string) => {
      if (orderId && typeof orderId === 'string') {
        socket.join(`order:${orderId}`);
      }
    });

    socket.on('leave:order', (orderId: string) => {
      if (orderId && typeof orderId === 'string') {
        socket.leave(`order:${orderId}`);
      }
    });
  });

  return io;
}

/**
 * Retrieve initialized Socket.IO instance
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Socket.IO Notification Dispatchers for Order & Delivery Lifecycle
 */
export const SocketEvents = {
  emitAssignmentCreated(riderId: string, vendorId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`rider:${riderId}`).emit('assignment:created', payload);
    io.to(`vendor:${vendorId}`).emit('assignment:created', payload);
    io.to('admin').emit('assignment:created', payload);
  },

  emitAssignmentAccepted(orderId: string, customerId: string, vendorId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`customer:${customerId}`).emit('assignment:accepted', payload);
    io.to(`vendor:${vendorId}`).emit('assignment:accepted', payload);
    io.to(`order:${orderId}`).emit('assignment:accepted', payload);
  },

  emitAssignmentRejected(orderId: string, vendorId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`vendor:${vendorId}`).emit('assignment:rejected', payload);
    io.to(`order:${orderId}`).emit('assignment:rejected', payload);
  },

  emitOrderOutForDelivery(orderId: string, customerId: string, vendorId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`customer:${customerId}`).emit('order:out_for_delivery', payload);
    io.to(`vendor:${vendorId}`).emit('order:out_for_delivery', payload);
    io.to(`order:${orderId}`).emit('order:out_for_delivery', payload);
  },

  emitOrderDelivered(
    orderId: string,
    customerId: string,
    vendorId: string,
    riderId: string | null,
    payload: Record<string, unknown>
  ) {
    if (!io) return;
    io.to(`customer:${customerId}`).emit('order:delivered', payload);
    io.to(`vendor:${vendorId}`).emit('order:delivered', payload);
    if (riderId) io.to(`rider:${riderId}`).emit('order:delivered', payload);
    io.to(`order:${orderId}`).emit('order:delivered', payload);
  },

  emitDeliveryFailed(orderId: string, customerId: string, vendorId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`customer:${customerId}`).emit('delivery:failed', payload);
    io.to(`vendor:${vendorId}`).emit('delivery:failed', payload);
    io.to(`order:${orderId}`).emit('delivery:failed', payload);
  },

  emitLocationUpdate(orderId: string, customerId: string, payload: Record<string, unknown>) {
    if (!io) return;
    io.to(`customer:${customerId}`).emit('location:update', payload);
    io.to(`order:${orderId}`).emit('location:update', payload);
  },
};
