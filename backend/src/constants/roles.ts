/**
 * Ringers Platform - Global Role Definitions
 * Aligned with database schema: identity.roles
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  VENDOR: 'VENDOR',
  DELIVERY_BOY: 'DELIVERY_BOY',
  CUSTOMER: 'CUSTOMER',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: RoleCode[] = Object.values(ROLES);

export const ROLE_HIERARCHY: Record<RoleCode, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  VENDOR: 50,
  DELIVERY_BOY: 30,
  CUSTOMER: 10,
};
