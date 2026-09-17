-- V15: Extend Payment Module — Wallets & Wallet Transactions
-- NOTE: payment.payment_transactions created in V8. This extends the payment schema.

-- 1. Wallets Table (one wallet per user — customer or vendor)
CREATE TABLE IF NOT EXISTS payment.wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE, -- references identity.users(id) logically
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (balance >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'INR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_wallets_user_id ON payment.wallets(user_id);

DROP TRIGGER IF EXISTS trg_payment_wallets_updated_at ON payment.wallets;
CREATE TRIGGER trg_payment_wallets_updated_at
    BEFORE UPDATE ON payment.wallets
    FOR EACH ROW EXECUTE FUNCTION set_updated_at_timestamp();

-- 2. Wallet Transactions Ledger (immutable append-only credit/debit log)
CREATE TABLE IF NOT EXISTS payment.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES payment.wallets(id) ON DELETE RESTRICT,
    transaction_type VARCHAR(10) NOT NULL CHECK (transaction_type IN ('CREDIT', 'DEBIT')),
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    balance_before NUMERIC(12, 2) NOT NULL,
    balance_after NUMERIC(12, 2) NOT NULL,
    reference_type VARCHAR(50) NOT NULL CHECK (reference_type IN (
        'ORDER_PAYMENT', 'ORDER_REFUND', 'TOPUP', 'WITHDRAWAL', 'VENDOR_CREDIT', 'ADJUSTMENT'
    )),
    reference_id UUID,         -- links to order or payment_transaction id if applicable
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_txn_wallet_id ON payment.wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_reference ON payment.wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_txn_created_at ON payment.wallet_transactions(created_at DESC);

-- 3. Add razorpay_order_id to payment_transactions for gateway idempotency
ALTER TABLE payment.payment_transactions
    ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS razorpay_signature VARCHAR(256) NULL,
    ADD COLUMN IF NOT EXISTS metadata JSONB NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_payment_txn_razorpay_order ON payment.payment_transactions(razorpay_order_id)
    WHERE razorpay_order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_txn_order_id ON payment.payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_user_id ON payment.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_txn_status ON payment.payment_transactions(status);
