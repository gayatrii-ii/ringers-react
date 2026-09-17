import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

// Load .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform((v) => parseInt(v, 10)).default('5000'),

  // PostgreSQL Connection
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform((v) => parseInt(v, 10)).default('5432'),
  DB_USER: z.string().default('ringer_user'),
  DB_PASSWORD: z.string().default('ringer_secure_password'),
  DB_NAME: z.string().default('ringer_db'),
  DB_POOL_MAX: z.string().transform((v) => parseInt(v, 10)).default('30'),
  DB_POOL_IDLE_TIMEOUT_MS: z.string().transform((v) => parseInt(v, 10)).default('30000'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long for production security'),
  JWT_ACCESS_EXPIRY: z.string().default('1h'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters long'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Super Admin Fallback / Seed Credentials
  SUPER_ADMIN_EMAIL: z.string().email().default('superadmin@ringer.com'),
  SUPER_ADMIN_PASSWORD: z.string().default('SuperAdmin@123!'),

  // Razorpay Payment Gateway (optional in dev/test, required in production)
  RAZORPAY_KEY_ID: z.string().optional().default(''),
  RAZORPAY_KEY_SECRET: z.string().optional().default(''),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional().default(''),

  // Map & Location Services (Free OpenStreetMap / Nominatim)
  MAP_SERVICE_PROVIDER: z.string().default('openstreetmap'),
  OSM_TILE_SERVER_URL: z.string().default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
  OSM_NOMINATIM_URL: z.string().default('https://nominatim.openstreetmap.org'),
  OSRM_ROUTING_URL: z.string().default('https://router.project-osrm.org'),
  OPENROUTESERVICE_API_KEY: z.string().optional().default(''),

  // Firebase Cloud Messaging (Push Notifications)
  FIREBASE_PROJECT_ID: z.string().optional().default(''),
  FIREBASE_CLIENT_EMAIL: z.string().optional().default(''),
  FIREBASE_PRIVATE_KEY: z.string().optional().default(''),

  // SMTP Email Server (Receipts, OTPs)
  SMTP_HOST: z.string().optional().default('smtp.gmail.com'),
  SMTP_PORT: z.string().transform((v) => parseInt(v, 10)).default('587'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  EMAIL_FROM: z.string().optional().default('Ringers <noreply@ringers.com>'),

  // SMS Gateway Configuration
  SMS_GATEWAY_PROVIDER: z.string().optional().default('fast2sms'),
  SMS_GATEWAY_API_KEY: z.string().optional().default(''),
  SMS_SENDER_ID: z.string().optional().default('RINGER'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000,http://localhost:5173'),
});

const parsedEnv = envSchema.safeParse(process.cwd() ? process.env : {});

if (!parsedEnv.success) {
  console.error('❌ Invalid environment variables detected at startup:');
  console.error(parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
