-- V14: Add Vendor Payment Settings and Admin Request Management Tables

-- 1. Extend Vendor Store with UPI Payment Details
ALTER TABLE vendor.vendors 
    ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS upi_qr_url TEXT NULL,
    ADD COLUMN IF NOT EXISTS upi_pay_url TEXT NULL;

-- 2. Vendor Registration Requests (Prospective vendors requesting a private key)
CREATE TABLE IF NOT EXISTS identity.vendor_registration_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(200) NOT NULL,
    shop_name VARCHAR(200) NULL,
    owner_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL,
    business_details TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    generated_key_id UUID NULL REFERENCES identity.vendor_private_keys(id) ON DELETE SET NULL,
    reviewed_by_admin_id UUID NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendor_requests_status ON identity.vendor_registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_vendor_requests_mobile_email ON identity.vendor_registration_requests(mobile, email);

DROP TRIGGER IF EXISTS trg_vendor_registration_requests_updated_at ON identity.vendor_registration_requests;
CREATE TRIGGER trg_vendor_registration_requests_updated_at
    BEFORE UPDATE ON identity.vendor_registration_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 3. Delivery Boy Job Requests (Riders seeking to be connected to vendors)
CREATE TABLE IF NOT EXISTS delivery.delivery_boy_job_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    mobile VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50) NULL,
    driving_license_number VARCHAR(100) NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONNECTED', 'REJECTED')),
    assigned_vendor_id UUID NULL REFERENCES vendor.vendors(id) ON DELETE SET NULL,
    reviewed_by_admin_id UUID NULL REFERENCES identity.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delivery_job_requests_status ON delivery.delivery_boy_job_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_job_requests_mobile ON delivery.delivery_boy_job_requests(mobile);

DROP TRIGGER IF EXISTS trg_delivery_boy_job_requests_updated_at ON delivery.delivery_boy_job_requests;
CREATE TRIGGER trg_delivery_boy_job_requests_updated_at
    BEFORE UPDATE ON delivery.delivery_boy_job_requests
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
