-- ===================================================================
-- V17: Create Phase 8 Operational Tables
-- Customer Products & Pricing, Customer Registration Requests,
-- Vendor Referrals, Support Tickets, and Delivery Lifecycle Extensions
-- ===================================================================

-- 1. Create Support Schema
CREATE SCHEMA IF NOT EXISTS support;

-- 2. Customer Product Selection & Custom Pricing
CREATE TABLE IF NOT EXISTS vendor.customer_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    customer_user_id UUID NOT NULL, -- references identity.users(id)
    product_id UUID NOT NULL REFERENCES catalog.products(id) ON DELETE CASCADE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    custom_price NUMERIC(12, 2) CHECK (custom_price IS NULL OR custom_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_vendor_customer_product UNIQUE (vendor_id, customer_user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_products_vendor_cust 
    ON vendor.customer_products(vendor_id, customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_products_customer 
    ON vendor.customer_products(customer_user_id);

DROP TRIGGER IF EXISTS trg_vendor_customer_products_updated_at ON vendor.customer_products;
CREATE TRIGGER trg_vendor_customer_products_updated_at
    BEFORE UPDATE ON vendor.customer_products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 3. Extend vendor.vendors with catalog restriction & referral code
ALTER TABLE vendor.vendors 
    ADD COLUMN IF NOT EXISTS restrict_customer_catalog BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS referral_code VARCHAR(50) UNIQUE;

-- 4. Customer Registration Requests (Flow A: Vendor initiated & Flow B: Customer direct)
CREATE TABLE IF NOT EXISTS customer.registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    initiated_by VARCHAR(20) NOT NULL DEFAULT 'CUSTOMER' 
        CHECK (initiated_by IN ('VENDOR', 'CUSTOMER')),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(255),
    photo_url VARCHAR(500),
    address_line_1 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(100),
    postal_code VARCHAR(20),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'OTP_VERIFIED', 'ACTIVATED', 'REJECTED')),
    notes TEXT,
    activated_user_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_reg_vendor_status 
    ON customer.registration_requests(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_reg_phone 
    ON customer.registration_requests(phone);

DROP TRIGGER IF EXISTS trg_customer_registration_requests_updated_at ON customer.registration_requests;
CREATE TRIGGER trg_customer_registration_requests_updated_at
    BEFORE UPDATE ON customer.registration_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 5. Extend delivery.delivery_boy_job_requests to allow ACTIVATED state and activated_user_id
ALTER TABLE delivery.delivery_boy_job_requests
    DROP CONSTRAINT IF EXISTS delivery_boy_job_requests_status_check;

ALTER TABLE delivery.delivery_boy_job_requests
    ADD CONSTRAINT delivery_boy_job_requests_status_check 
    CHECK (status IN ('PENDING', 'CONNECTED', 'ACTIVATED', 'REJECTED'));

ALTER TABLE delivery.delivery_boy_job_requests
    ADD COLUMN IF NOT EXISTS activated_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_delivery_job_requests_vendor 
    ON delivery.delivery_boy_job_requests(assigned_vendor_id);

-- 6. Vendor Referral Program
CREATE TABLE IF NOT EXISTS vendor.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    referred_vendor_id UUID REFERENCES vendor.vendors(id) ON DELETE SET NULL,
    referee_phone VARCHAR(30),
    referee_email VARCHAR(255),
    referral_code VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'INVITED'
        CHECK (status IN ('INVITED', 'REGISTERED', 'APPROVED', 'ACTIVE')),
    reward_status VARCHAR(30) NOT NULL DEFAULT 'PENDING'
        CHECK (reward_status IN ('PENDING', 'APPROVED', 'PAID', 'CANCELLED')),
    reward_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (reward_amount >= 0),
    reward_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer 
    ON vendor.referrals(referrer_vendor_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code 
    ON vendor.referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_status 
    ON vendor.referrals(status);

DROP TRIGGER IF EXISTS trg_vendor_referrals_updated_at ON vendor.referrals;
CREATE TRIGGER trg_vendor_referrals_updated_at
    BEFORE UPDATE ON vendor.referrals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 7. Support & Issue Tickets
CREATE TABLE IF NOT EXISTS support.tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(50) NOT NULL UNIQUE,
    user_id UUID NOT NULL, -- references identity.users(id)
    order_id UUID REFERENCES order_management.orders(id) ON DELETE SET NULL,
    category VARCHAR(50) NOT NULL 
        CHECK (category IN ('ORDER_ISSUE', 'PAYMENT_ISSUE', 'DELIVERY_ISSUE', 'GENERAL')),
    subject VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' 
        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    admin_response TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user 
    ON support.tickets(user_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order 
    ON support.tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status 
    ON support.tickets(status);

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support.tickets;
CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON support.tickets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 8. Delivery Assignments extensions
ALTER TABLE delivery.delivery_assignments
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS failure_reason VARCHAR(50),
    ADD COLUMN IF NOT EXISTS failure_notes TEXT,
    ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;

-- 9. Order delivery_status check constraint update to include ACCEPTED
ALTER TABLE order_management.orders
    DROP CONSTRAINT IF EXISTS orders_delivery_status_check;

ALTER TABLE order_management.orders
    ADD CONSTRAINT orders_delivery_status_check
    CHECK (delivery_status IN ('UNASSIGNED', 'ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'FAILED'));
