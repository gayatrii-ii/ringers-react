-- V5: Create Customer Module Tables
CREATE TABLE IF NOT EXISTS customer.customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- references identity.users(id) logically
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
    profile_image VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL, -- references identity.users(id) logically
    address_type VARCHAR(30) NOT NULL DEFAULT 'HOME' CHECK (address_type IN ('HOME', 'WORK', 'OTHER')),
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    postal_code VARCHAR(20) NOT NULL,
    latitude NUMERIC(10, 7),
    longitude NUMERIC(10, 7),
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ NULL
);

DROP TRIGGER IF EXISTS trg_customer_customer_profiles_updated_at ON customer.customer_profiles;
CREATE TRIGGER trg_customer_customer_profiles_updated_at
    BEFORE UPDATE ON customer.customer_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON customer.addresses;
CREATE TRIGGER trg_customer_addresses_updated_at
    BEFORE UPDATE ON customer.addresses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
