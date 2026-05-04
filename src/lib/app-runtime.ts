import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_SCHEMA_VERSION = Number(process.env.REQUIRED_SCHEMA_VERSION ?? "1");
const QUERY_EXECUTION_ENABLED = process.env.QUERY_EXECUTION_ENABLED !== "false";
const AUTO_APPLY_MIGRATIONS = process.env.AUTO_APPLY_MIGRATIONS !== "false";
const STRICT_SCHEMA_GATE = process.env.STRICT_SCHEMA_GATE === "true";
let migrationAttemptPromise: Promise<void> | null = null;

export function isQueryExecutionEnabled(): boolean {
  return QUERY_EXECUTION_ENABLED;
}

function shouldFailOpenSchemaGate(): boolean {
  if (STRICT_SCHEMA_GATE) return false;
  return process.env.NODE_ENV === "production";
}

async function applyBaselineMigrationsOnce() {
  if (!AUTO_APPLY_MIGRATIONS) return;
  if (migrationAttemptPromise) {
    await migrationAttemptPromise;
    return;
  }

  migrationAttemptPromise = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL missing for migration bootstrap");
    }

    const pool = new Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });

    try {
      const migrationFiles = ["00001_init.sql", "00002_billing_hardening.sql"];
      for (const file of migrationFiles) {
        const sql = readFileSync(join(process.cwd(), "migrations", file), "utf8");
        await pool.query(sql);
      }
    } finally {
      await pool.end();
    }
  })();

  try {
    await migrationAttemptPromise;
  } finally {
    migrationAttemptPromise = null;
  }
}

export async function ensureSchemaCompatibility() {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("app_meta")
    .select("schema_version")
    .eq("id", 1)
    .single();

  if (error || !data) {
    const probe = await supabase.from("data_sources").select("id").limit(1);

    if (!probe.error) {
      return { ok: true as const };
    }

    try {
      await applyBaselineMigrationsOnce();
      const retry = await supabase
        .from("app_meta")
        .select("schema_version")
        .eq("id", 1)
        .single();
      data = retry.data;
      error = retry.error;
      if (!error && data) {
        return { ok: true as const };
      }
    } catch (migrationError) {
      if (shouldFailOpenSchemaGate()) {
        console.error("[schema-gate] fail-open after migration bootstrap failure", {
          reason:
            migrationError instanceof Error
              ? migrationError.message
              : "unknown_migration_error",
        });
        return { ok: true as const };
      }
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: "schema_meta_unavailable",
            message:
              "Schema metadata unavailable and automatic migration bootstrap failed.",
            hint: "Verify DATABASE_URL has migrate permissions and run migrations/00001_init.sql + 00002_billing_hardening.sql manually.",
            details:
              migrationError instanceof Error
                ? migrationError.message
                : "unknown_migration_error",
          },
          { status: 503 }
        ),
      };
    }

    if (shouldFailOpenSchemaGate()) {
      console.error("[schema-gate] fail-open after metadata probe failure", {
        appMetaError: error?.message ?? "unknown_error",
        probeError: probe.error?.message ?? "unknown_error",
      });
      return { ok: true as const };
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "schema_meta_unavailable",
          message:
            "Schema metadata unavailable. Run the baseline migration (migrations/00001_init.sql) and retry.",
          hint: "Apply migrations, then refresh the app.",
          details: probe.error.message,
        },
        { status: 503 }
      ),
    };
  }

  if (Number(data.schema_version) < REQUIRED_SCHEMA_VERSION) {
    if (shouldFailOpenSchemaGate()) {
      console.error("[schema-gate] fail-open on version mismatch", {
        required: REQUIRED_SCHEMA_VERSION,
        current: Number(data.schema_version),
      });
      return { ok: true as const };
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "schema_version_incompatible",
          message: "Application requires a newer database schema",
        },
        { status: 503 }
      ),
    };
  }

  return { ok: true as const };
}
