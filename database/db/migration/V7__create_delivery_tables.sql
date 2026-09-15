-- V7: Create Delivery Module Tables
CREATE TABLE IF NOT EXISTS delivery.delivery_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- references identity.users(id) logically
    vehicle_type VARCHAR(50) NOT NULL CHECK (vehicle_type IN ('BIKE', 'SCOOTER', 'CYCLE', 'VAN', 'OTHER')),
    vehicle_number VARCHAR(50),
    license_number VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'OFFLINE' CHECK (status IN ('OFFLINE', 'ONLINE', 'BUSY', 'SUSPENDED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,         -- references order_management.orders(id) logically
    delivery_boy_id UUID NOT NULL,  -- references identity.users(id) logically
    status VARCHAR(30) NOT NULL DEFAULT 'ASSIGNED' 
        CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'PICKED_UP', 'DELIVERED', 'CANCELLED')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- High-volume append-only GPS tracking: BIGSERIAL sequence
CREATE TABLE IF NOT EXISTS delivery.delivery_locations (
    id BIGSERIAL PRIMARY KEY,
    assignment_id UUID NOT NULL REFERENCES delivery.delivery_assignments(id) ON DELETE CASCADE,
    delivery_boy_id UUID NOT NULL, -- references identity.users(id) logically
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    accuracy NUMERIC(6, 2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DROP TRIGGER IF EXISTS trg_delivery_delivery_profiles_updated_at ON delivery.delivery_profiles;
CREATE TRIGGER trg_delivery_delivery_profiles_updated_at
    BEFORE UPDATE ON delivery.delivery_profiles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

DROP TRIGGER IF EXISTS trg_delivery_delivery_assignments_updated_at ON delivery.delivery_assignments;
CREATE TRIGGER trg_delivery_delivery_assignments_updated_at
    BEFORE UPDATE ON delivery.delivery_assignments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
