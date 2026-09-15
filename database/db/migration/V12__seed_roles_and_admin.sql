-- V12: Seed Default Platform Roles and Super Administrator

-- Standard platform roles
INSERT INTO identity.roles (id, name, code, description)
VALUES 
    ('11111111-1111-1111-1111-111111111101', 'Super Administrator', 'SUPER_ADMIN', 'Platform owner with full system access and module control'),
    ('11111111-1111-1111-1111-111111111102', 'Administrator', 'ADMIN', 'Platform operations and management staff'),
    ('11111111-1111-1111-1111-111111111103', 'Vendor', 'VENDOR', 'Merchant / Restaurant owner who manages catalog and orders'),
    ('11111111-1111-1111-1111-111111111104', 'Customer', 'CUSTOMER', 'End user who places orders and tracks deliveries'),
    ('11111111-1111-1111-1111-111111111105', 'Delivery Partner', 'DELIVERY_BOY', 'Delivery rider assigned to fulfill orders')
ON CONFLICT (code) DO NOTHING;

-- Initial default SuperAdmin user (Password: SuperAdmin@123! hashed with BCrypt $2a$10$)
INSERT INTO identity.users (
    id, first_name, last_name, email, phone, password_hash, status, is_verified
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Super',
    'Admin',
    'superadmin@ringer.com',
    '+919999999999',
    '$2a$10$7vN3vB29z.5hP5ZfKkJrxe69V5U01yR9.K5i8vGZzZ3eJzB4.J9Wq',
    'ACTIVE',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Map SuperAdmin user to SUPER_ADMIN role
INSERT INTO identity.user_roles (user_id, role_id)
VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '11111111-1111-1111-1111-111111111101'
) ON CONFLICT (user_id, role_id) DO NOTHING;

-- Sample Top-Level and Sub-Categories
INSERT INTO catalog.categories (id, parent_id, name, slug, description, status)
VALUES 
    ('22222222-2222-2222-2222-222222222201', NULL, 'Food & Dining', 'food-and-dining', 'Delicious dishes and meals', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222202', NULL, 'Groceries', 'groceries', 'Daily essentials and kitchen items', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222203', '22222222-2222-2222-2222-222222222201', 'Pizza', 'pizza', 'Hand-tossed Italian pizzas', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222204', '22222222-2222-2222-2222-222222222201', 'Burgers', 'burgers', 'Gourmet burgers and fries', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222205', '22222222-2222-2222-2222-222222222201', 'Beverages', 'beverages', 'Cold drinks, juices and shakes', 'ACTIVE')
ON CONFLICT (slug) DO NOTHING;
