-- ===================================================================
-- V16: Create Notification Device Tokens, Customer Reviews, and Analytics Performance Indexes
-- ===================================================================

-- 1. Notification Module: User Device Tokens for Push Notifications (FCM)
CREATE TABLE IF NOT EXISTS notification.user_device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references identity.users(id) logically
    fcm_token TEXT NOT NULL,
    device_type VARCHAR(20) NOT NULL DEFAULT 'ANDROID' CHECK (device_type IN ('ANDROID', 'IOS', 'WEB')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_device_fcm UNIQUE (user_id, fcm_token)
);

-- 2. Customer Module: Order Reviews & Ratings
CREATE TABLE IF NOT EXISTS customer.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL, -- references order_management.orders(id) logically
    customer_id UUID NOT NULL, -- references identity.users(id) logically
    vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    delivery_partner_id UUID, -- references identity.users(id) logically
    vendor_rating SMALLINT NOT NULL CHECK (vendor_rating BETWEEN 1 AND 5),
    delivery_rating SMALLINT CHECK (delivery_rating IS NULL OR delivery_rating BETWEEN 1 AND 5),
    vendor_review TEXT,
    delivery_review TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_order_review UNIQUE (order_id)
);

-- 3. Add rating summary columns to vendor.vendors if not already present
ALTER TABLE vendor.vendors 
ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.00,
ADD COLUMN IF NOT EXISTS total_reviews INTEGER DEFAULT 0;

-- 4. High-Performance Indexes for 10,000+ Users Scale
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
    ON notification.notifications(user_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_device_tokens_user 
    ON notification.user_device_tokens(user_id) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_reviews_vendor 
    ON customer.reviews(vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_customer 
    ON customer.reviews(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_analytics_created 
    ON order_management.orders(created_at DESC, status, total_amount);
