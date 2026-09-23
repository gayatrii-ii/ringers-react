-- =========================================================================================
-- Migration V19: Add Wallet PIN, Support Expansion, Delivery Reassignment & Performance Indexes
-- =========================================================================================

-- 1. Wallet PIN for secure customer wallet payments
ALTER TABLE payment.wallets 
    ADD COLUMN IF NOT EXISTS wallet_pin_hash VARCHAR(255);

-- 2. Expand support.tickets category constraint and add vendor resolution fields
ALTER TABLE support.tickets 
    DROP CONSTRAINT IF EXISTS tickets_category_check;

ALTER TABLE support.tickets 
    ADD CONSTRAINT tickets_category_check 
    CHECK (category IN ('ORDER_ISSUE', 'PAYMENT_ISSUE', 'DELIVERY_ISSUE', 'ACCOUNT_ISSUE', 'WALLET_ISSUE', 'GENERAL'));

ALTER TABLE support.tickets
    ADD COLUMN IF NOT EXISTS sub_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendor.vendors(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS vendor_response TEXT,
    ADD COLUMN IF NOT EXISTS vendor_responded_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_support_tickets_vendor 
    ON support.tickets(vendor_id, status);

-- 3. Extend delivery_assignments status check to allow REASSIGNED
ALTER TABLE delivery.delivery_assignments
    DROP CONSTRAINT IF EXISTS delivery_assignments_status_check;

ALTER TABLE delivery.delivery_assignments
    ADD CONSTRAINT delivery_assignments_status_check
    CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'PICKED_UP', 'DELIVERED', 'FAILED', 'REJECTED', 'CANCELLED', 'REASSIGNED'));

-- 4. Extend identity.users and delivery/vendor profiles for language and status
ALTER TABLE delivery.delivery_profiles
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'EN';

ALTER TABLE vendor.vendors
    ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'EN';

-- 5. Performance indexes for admin queries & customer activity
CREATE INDEX IF NOT EXISTS idx_users_status ON identity.users(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON order_management.orders(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_vendor_status ON order_management.orders(vendor_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON order_management.orders(payment_method);
