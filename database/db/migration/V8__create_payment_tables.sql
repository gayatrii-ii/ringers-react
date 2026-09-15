-- V8: Create Payment Module Tables
CREATE TABLE IF NOT EXISTS payment.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL, -- references order_management.orders(id) logically
    user_id UUID NOT NULL,  -- references identity.users(id) logically
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('RAZORPAY', 'STRIPE', 'PAYTM', 'CASH_ON_DELIVERY', 'WALLET')),
    transaction_reference VARCHAR(100),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(30) NOT NULL DEFAULT 'INITIATED' 
        CHECK (status IN ('INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED')),
    payment_method VARCHAR(50) CHECK (payment_method IS NULL OR payment_method IN ('UPI', 'CARD', 'NET_BANKING', 'WALLET', 'COD')),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_payment_txn_reference UNIQUE (transaction_reference)
);

DROP TRIGGER IF EXISTS trg_payment_payment_transactions_updated_at ON payment.payment_transactions;
CREATE TRIGGER trg_payment_payment_transactions_updated_at
    BEFORE UPDATE ON payment.payment_transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();
