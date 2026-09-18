-- V18: Create Notification Preferences and Supporting Structures
CREATE TABLE IF NOT EXISTS notification.user_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,
    order_updates BOOLEAN NOT NULL DEFAULT TRUE,
    promotional_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_status BOOLEAN NOT NULL DEFAULT TRUE,
    sms_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    push_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_user_preferences_user_id 
    ON notification.user_preferences(user_id);
