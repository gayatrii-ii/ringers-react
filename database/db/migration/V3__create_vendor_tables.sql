-- V3: Create Vendor Module Tables
CREATE TABLE IF NOT EXISTS vendor.vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id UUID NOT NULL, -- references identity.users(id) logically
    business_name VARCHAR(200) NOT NULL,
    business_code VARCHAR(50) NOT NULL,
    description TEXT,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (status IN ('PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'CLOSED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ NULL,
    CONSTRAINT uk_vendor_business_code UNIQUE (business_code)
);

CREATE TABLE IF NOT EXISTS vendor.vendor_addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    postal_code VARCHAR(20) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendor.vendor_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendor.vendors(id) ON DELETE CASCADE,
    user_id UUID NOT NULL, -- references identity.users(id) logically
    designation VARCHAR(50) NOT NULL DEFAULT 'STAFF' CHECK (designation IN ('OWNER', 'MANAGER', 'STAFF', 'CHEF')),
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_vendor_users UNIQUE (vendor_id, user_id)
);

DROP TRIGGER IF EXISTS trg_vendor_vendors_updated_at ON vendor.vendors;
CREATE TRIGGER trg_vendor_vendors_updated_at
    BEFORE UPDATE ON vendor.vendors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_vendor_vendor_addresses_updated_at ON vendor.vendor_addresses;
CREATE TRIGGER trg_vendor_vendor_addresses_updated_at
    BEFORE UPDATE ON vendor.vendor_addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
