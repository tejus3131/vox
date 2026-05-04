import type { SupabaseClient } from "@supabase/supabase-js";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedSchema {
  schema_json: Record<string, unknown>;
  fk_json: Record<string, unknown> | null;
  row_counts_json: Record<string, unknown> | null;
  cached_at: string;
}

export async function getCachedSchema(
  supabase: SupabaseClient,
  dataSourceId: string
): Promise<CachedSchema | null> {
  const { data } = await supabase
    .from("schema_cache")
    .select("*")
    .eq("data_source_id", dataSourceId)
    .single();

  if (!data) return null;

  const cachedAt = new Date(data.cached_at).getTime();
  if (Date.now() - cachedAt > CACHE_TTL_MS) {
    return null;
  }

  return data as CachedSchema;
}

export async function setCachedSchema(
  supabase: SupabaseClient,
  dataSourceId: string,
  schema: {
    schema_json: Record<string, unknown>;
    fk_json?: Record<string, unknown>;
    row_counts_json?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("schema_cache").upsert(
    {
      data_source_id: dataSourceId,
      schema_json: schema.schema_json,
      fk_json: schema.fk_json ?? null,
      row_counts_json: schema.row_counts_json ?? null,
      cached_at: new Date().toISOString(),
    } as Record<string, unknown>,
    { onConflict: "data_source_id" }
  );
}

export async function invalidateSchemaCache(
  supabase: SupabaseClient,
  dataSourceId: string
): Promise<void> {
  await supabase.from("schema_cache").delete().eq("data_source_id", dataSourceId);
}
