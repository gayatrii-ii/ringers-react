import http from 'http';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { testDatabaseConnection, pool } from './config/database.js';
import { initSocketServer } from './config/socket.js';

async function bootstrap() {
  try {
    // 1. Verify Database Connectivity (warn/log if DB is not currently running locally)
    try {
      await testDatabaseConnection();
    } catch (dbErr) {
      console.warn('⚠️ Warning: PostgreSQL not reachable yet. Ensure docker-compose is running.');
    }

    // 2. Initialize Express Application & Socket.IO
    const app = createApp();
    const server = http.createServer(app);
    initSocketServer(server);

    server.listen(env.PORT, () => {
      console.log(`🚀 Ringers Backend API running on http://localhost:${env.PORT}`);
      console.log(`📡 Environment: ${env.NODE_ENV}`);
      console.log(`🔒 Authentication & RBAC Engine: Active`);
      console.log(`⚡ Real-Time Socket.IO Server: Active`);
    });

    // 3. Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

      server.close(async () => {
        console.log('🔌 HTTP server closed.');
        try {
          await pool.end();
          console.log('💾 PostgreSQL pool drained.');
          process.exit(0);
        } catch (err) {
          console.error('Error during database pool shutdown:', err);
          process.exit(1);
        }
      });

      // Force exit if hanging
      setTimeout(() => {
        console.error('⚠️ Forcefully shutting down due to timeout.');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error('💥 Fatal error during server bootstrap:', error);
    process.exit(1);
  }
}

bootstrap();
