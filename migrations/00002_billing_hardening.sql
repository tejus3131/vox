-- Billing/autopay hardening migration.

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE payment_methods
  ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_due_paise INTEGER,
  ADD COLUMN IF NOT EXISTS amount_paid_paise INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS external_error TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE invoices
SET amount_due_paise = total_paise
WHERE amount_due_paise IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'invoices'
      AND column_name = 'amount_due_paise'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE invoices
      ALTER COLUMN amount_due_paise SET NOT NULL;
  END IF;
END $$;

ALTER TABLE webhook_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed',
  ADD COLUMN IF NOT EXISTS error_text TEXT,
  ADD COLUMN IF NOT EXISTS payload_json JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_org_period
  ON invoices(org_id, period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_invoices_status
  ON invoices(status);
