import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const REQUIRED_SCHEMA_VERSION = Number(process.env.REQUIRED_SCHEMA_VERSION ?? "1");
const QUERY_EXECUTION_ENABLED = process.env.QUERY_EXECUTION_ENABLED !== "false";

export function isQueryExecutionEnabled(): boolean {
  return QUERY_EXECUTION_ENABLED;
}

export async function ensureSchemaCompatibility() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_meta")
    .select("schema_version")
    .eq("id", 1)
    .single();

  if (error || !data) {
    const probe = await supabase.from("data_sources").select("id").limit(1);

    if (!probe.error) {
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
        },
        { status: 503 }
      ),
    };
  }

  if (Number(data.schema_version) < REQUIRED_SCHEMA_VERSION) {
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
