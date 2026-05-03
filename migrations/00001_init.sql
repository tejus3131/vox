-- Vox baseline migration for new databases.
-- Run Better Auth migrations first (for "member"/org tables), then run this file.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema metadata gate
CREATE TABLE IF NOT EXISTS app_meta (
  id INTEGER PRIMARY KEY,
  schema_version INTEGER NOT NULL
);

INSERT INTO app_meta (id, schema_version)
VALUES (1, 1)
ON CONFLICT (id) DO UPDATE SET schema_version = EXCLUDED.schema_version;

-- Core app tables
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  name TEXT NOT NULL,
  db_type TEXT NOT NULL DEFAULT 'postgresql',
  status TEXT NOT NULL DEFAULT 'active',
  encrypted_host TEXT NOT NULL,
  encrypted_port TEXT NOT NULL,
  encrypted_database TEXT NOT NULL,
  encrypted_username TEXT NOT NULL,
  encrypted_password TEXT NOT NULL,
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  org_id TEXT,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  archived BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  model TEXT,
  token_usage JSONB,
  error JSONB,
  parent_message_id UUID,
  branch_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS query_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  attempt_index INTEGER NOT NULL DEFAULT 0,
  sql_text TEXT NOT NULL,
  status TEXT NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  columns JSONB,
  rows_preview JSONB,
  latency_ms INTEGER,
  error_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Org access matrix
CREATE TABLE IF NOT EXISTS data_source_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  data_source_id UUID NOT NULL REFERENCES data_sources(id) ON DELETE CASCADE,
  granted_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id, data_source_id)
);

-- Schema cache
CREATE TABLE IF NOT EXISTS schema_cache (
  data_source_id UUID PRIMARY KEY REFERENCES data_sources(id) ON DELETE CASCADE,
  schema_json JSONB NOT NULL,
  fk_json JSONB,
  row_counts_json JSONB,
  cached_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing tables
CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT UNIQUE NOT NULL,
  razorpay_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'trial',
  trial_ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key TEXT UNIQUE NOT NULL,
  org_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chat_message_id UUID NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_paise INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  razorpay_token_id TEXT NOT NULL,
  type TEXT NOT NULL,
  last4 TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  total_paise INTEGER NOT NULL,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_data_sources_org ON data_sources(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_org ON chat_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_data_source ON chat_sessions(data_source_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_chat_session ON chat_messages(chat_session_id);
CREATE INDEX IF NOT EXISTS idx_cm_parent ON chat_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_cm_active ON chat_messages(chat_session_id, is_active);
CREATE INDEX IF NOT EXISTS idx_query_runs_chat_message ON query_runs(chat_message_id);
CREATE INDEX IF NOT EXISTS idx_dsa_org_user ON data_source_access(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_dsa_datasource ON data_source_access(data_source_id);
CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_period ON usage_ledger(org_id, created_at);

-- RLS safety net (requires Better Auth org/member tables)
ALTER TABLE data_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_source_access ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.member') IS NOT NULL THEN
    DROP POLICY IF EXISTS "org_member_read_ds" ON data_sources;
    CREATE POLICY "org_member_read_ds" ON data_sources
      FOR SELECT USING (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
        )
      );

    DROP POLICY IF EXISTS "org_admin_insert_ds" ON data_sources;
    CREATE POLICY "org_admin_insert_ds" ON data_sources
      FOR INSERT WITH CHECK (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        )
      );

    DROP POLICY IF EXISTS "org_admin_update_ds" ON data_sources;
    CREATE POLICY "org_admin_update_ds" ON data_sources
      FOR UPDATE USING (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        )
      );

    DROP POLICY IF EXISTS "org_admin_delete_ds" ON data_sources;
    CREATE POLICY "org_admin_delete_ds" ON data_sources
      FOR DELETE USING (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        )
      );

    DROP POLICY IF EXISTS "org_member_read_cs" ON chat_sessions;
    CREATE POLICY "org_member_read_cs" ON chat_sessions
      FOR SELECT USING (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
        )
      );

    DROP POLICY IF EXISTS "org_member_insert_cs" ON chat_sessions;
    CREATE POLICY "org_member_insert_cs" ON chat_sessions
      FOR INSERT WITH CHECK (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
        )
      );

    DROP POLICY IF EXISTS "org_member_update_cs" ON chat_sessions;
    CREATE POLICY "org_member_update_cs" ON chat_sessions
      FOR UPDATE USING (
        user_id = current_setting('app.user_id', true)
      );

    DROP POLICY IF EXISTS "org_admin_manage_dsa" ON data_source_access;
    CREATE POLICY "org_admin_manage_dsa" ON data_source_access
      FOR ALL USING (
        org_id IN (
          SELECT "organizationId" FROM "member"
          WHERE "userId" = current_setting('app.user_id', true)
            AND role IN ('owner', 'admin')
        )
      );

    DROP POLICY IF EXISTS "org_member_read_own_dsa" ON data_source_access;
    CREATE POLICY "org_member_read_own_dsa" ON data_source_access
      FOR SELECT USING (
        user_id = current_setting('app.user_id', true)
      );
  ELSE
    RAISE NOTICE 'Skipping RLS policy creation: Better Auth table "member" not found yet. Run Better Auth migration, then re-run this SQL (safe/idempotent).';
  END IF;
END $$;
