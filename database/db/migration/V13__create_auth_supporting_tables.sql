-- V13: Create Auth Supporting Tables (Vendor Private Keys, Refresh Tokens, and OTPs)

-- 1. Vendor Private Registration Keys
CREATE TABLE IF NOT EXISTS identity.vendor_private_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_code VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED', 'REVOKED')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_by_vendor_id UUID NULL,
    created_by_admin_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_identity_vendor_private_keys_key_code UNIQUE (key_code)
);

CREATE INDEX IF NOT EXISTS idx_vendor_private_keys_code_status ON identity.vendor_private_keys(key_code, status);

DROP TRIGGER IF EXISTS trg_vendor_private_keys_updated_at ON identity.vendor_private_keys;
CREATE TRIGGER trg_vendor_private_keys_updated_at
    BEFORE UPDATE ON identity.vendor_private_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 2. User Session / Refresh Tokens
CREATE TABLE IF NOT EXISTS identity.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON identity.refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON identity.refresh_tokens(token_hash);

-- 3. One-Time Passwords (OTPs)
CREATE TABLE IF NOT EXISTS identity.otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    otp_code_hash VARCHAR(255) NOT NULL,
    purpose VARCHAR(50) NOT NULL DEFAULT 'VERIFICATION' CHECK (purpose IN ('VERIFICATION', 'LOGIN', 'PASSWORD_RESET', 'DELIVERY_CONFIRMATION')),
    attempts INT NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otps_phone_purpose ON identity.otps(phone, purpose, is_verified);
