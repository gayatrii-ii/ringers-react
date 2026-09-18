/**
 * Ringers Platform - Super Admin Setup Script
 * Reads credentials strictly from local .env and securely provisions or updates the Super Admin user.
 * 
 * Usage:
 *   npm run admin:setup
 */
import bcrypt from 'bcryptjs';
import { query, withTransaction } from '../src/config/database.js';
import { env } from '../src/config/env.js';

async function setupSuperAdmin() {
  console.log('🔐 Ringers Platform — Super Admin Provisioning Script');

  const adminEmail = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = env.SUPER_ADMIN_PASSWORD?.trim();

  if (!adminEmail || !adminPassword) {
    console.error('❌ Error: SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be defined in your .env file.');
    console.error('Please update your backend/.env file and try again.');
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error('❌ Error: SUPER_ADMIN_PASSWORD must be at least 8 characters long for security.');
    process.exit(1);
  }

  console.log(`Setting up Super Admin for: ${adminEmail}`);

  try {
    await withTransaction(async (client) => {
      // 1. Ensure SUPER_ADMIN role exists
      const roleRes = await client.query(
        `SELECT id FROM identity.roles WHERE code = 'SUPER_ADMIN'`
      );

      let roleId: string;
      if (roleRes.rows.length === 0) {
        const newRole = await client.query(
          `INSERT INTO identity.roles (name, code, description)
           VALUES ('Super Administrator', 'SUPER_ADMIN', 'Platform owner with full system access and governance')
           RETURNING id`
        );
        roleId = newRole.rows[0].id;
      } else {
        roleId = roleRes.rows[0].id;
      }

      // 2. Hash the password with BCrypt (12 rounds)
      const salt = await bcrypt.genSalt(12);
      const passwordHash = await bcrypt.hash(adminPassword, salt);

      // 3. Check if user already exists
      const userRes = await client.query(
        `SELECT id FROM identity.users WHERE email = $1`,
        [adminEmail]
      );

      let userId: string;
      if (userRes.rows.length > 0) {
        userId = userRes.rows[0].id;
        // Update password and ensure active status
        await client.query(
          `UPDATE identity.users 
           SET password_hash = $1, status = 'ACTIVE', is_verified = TRUE, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [passwordHash, userId]
        );
        console.log(`Updated existing user password for: ${adminEmail}`);
      } else {
        // Insert new super admin user
        const newUser = await client.query(
          `INSERT INTO identity.users (
             first_name, last_name, email, phone, password_hash, status, is_verified
           ) VALUES (
             'Super', 'Admin', $1, '+919999999999', $2, 'ACTIVE', TRUE
           ) RETURNING id`,
          [adminEmail, passwordHash]
        );
        userId = newUser.rows[0].id;
        console.log(`Created new Super Admin account for: ${adminEmail}`);
      }

      // 4. Attach SUPER_ADMIN role
      await client.query(
        `INSERT INTO identity.user_roles (user_id, role_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [userId, roleId]
      );
    });

    console.log('✅ Super Admin setup successfully completed!');
    console.log(`Email: ${adminEmail}`);
    console.log('Password: (secured and hashed with BCrypt factor 12)');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to provision Super Admin:', error);
    process.exit(1);
  }
}

setupSuperAdmin();
