-- V10: Create Audit Module Tables
CREATE TABLE IF NOT EXISTS audit.audit_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID, -- references identity.users(id) logically
    action VARCHAR(100) NOT NULL,
    module VARCHAR(50) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
