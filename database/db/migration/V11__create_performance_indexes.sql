-- V11: Create Performance Indexes across all modules

-- Identity indexes
CREATE INDEX IF NOT EXISTS idx_identity_users_status ON identity.users(status);
CREATE INDEX IF NOT EXISTS idx_identity_user_roles_user ON identity.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_user_roles_role ON identity.user_roles(role_id);

-- Vendor indexes
CREATE INDEX IF NOT EXISTS idx_vendor_vendors_owner ON vendor.vendors(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_vendor_vendors_status ON vendor.vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendor_addresses_vendor ON vendor.vendor_addresses(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_users_user ON vendor.vendor_users(user_id);

-- Catalog indexes
CREATE INDEX IF NOT EXISTS idx_catalog_categories_parent ON catalog.categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_vendor ON catalog.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_category ON catalog.products(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_products_status ON catalog.products(status);
CREATE INDEX IF NOT EXISTS idx_catalog_products_price ON catalog.products(price, discount_price);
CREATE INDEX IF NOT EXISTS idx_catalog_product_images_product ON catalog.product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_catalog_product_variants_product ON catalog.product_variants(product_id);

-- Customer indexes
CREATE INDEX IF NOT EXISTS idx_customer_addresses_user ON customer.addresses(user_id, is_default);

-- Order indexes
CREATE INDEX IF NOT EXISTS idx_orders_customer ON order_management.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON order_management.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON order_management.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON order_management.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON order_management.orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_placed_at ON order_management.orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_management.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_management.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_management.order_status_history(order_id, created_at DESC);

-- Delivery indexes
CREATE INDEX IF NOT EXISTS idx_delivery_profiles_status ON delivery.delivery_profiles(status);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order ON delivery.delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_delivery_boy ON delivery.delivery_assignments(delivery_boy_id, status);
CREATE INDEX IF NOT EXISTS idx_delivery_locations_assignment ON delivery.delivery_locations(assignment_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_locations_boy ON delivery.delivery_locations(delivery_boy_id, recorded_at DESC);

-- Payment indexes
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_user ON payment.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment.payment_transactions(status);

-- Notification indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notification.notifications(user_id, is_read, created_at DESC);

-- Audit indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit.audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit.audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit.audit_logs(created_at DESC);
