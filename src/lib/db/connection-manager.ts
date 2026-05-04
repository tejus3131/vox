import type { DecryptedDataSource } from "@/types";
import { Pool, type PoolClient, type QueryResult } from "pg";
import { setDefaultResultOrder } from "node:dns";

interface SqlPolicy {
  statementTimeoutMs: number;
  rowCap: number;
}

const DEFAULT_POLICY: SqlPolicy = {
  statementTimeoutMs: 10_000,
  rowCap: 200,
};

try {
  // Keep prod DNS behavior consistent with local environments where IPv4 often resolves reliably.
  setDefaultResultOrder("ipv4first");
} catch {
  // no-op for runtimes that do not support overriding DNS result order.
}

const pools = new Map<string, Pool>();

function normalizeSource(source: DecryptedDataSource): DecryptedDataSource {
  const clean = (value: string) => value.trim().replace(/^['"]|['"]$/g, "");
  return {
    ...source,
    host: clean(source.host),
    port: clean(source.port || "5432") || "5432",
    database: clean(source.database),
    username: clean(source.username),
    password: source.password,
  };
}

function keyForSource(source: DecryptedDataSource): string {
  const s = normalizeSource(source);
  return `${s.host}:${s.port}:${s.database}:${s.username}`;
}

function getPool(source: DecryptedDataSource): Pool {
  const normalized = normalizeSource(source);
  const key = keyForSource(source);
  const existing = pools.get(key);
  if (existing) return existing;

  const pool = new Pool({
    host: normalized.host,
    port: Number(normalized.port || "5432"),
    database: normalized.database,
    user: normalized.username,
    password: normalized.password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pools.set(key, pool);
  return pool;
}

async function testWithSource(source: DecryptedDataSource): Promise<void> {
  const pool = getPool(source);
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
  }
}

export async function testDataSourceConnection(
  source: DecryptedDataSource
): Promise<DecryptedDataSource> {
  const normalized = normalizeSource(source);
  try {
    await testWithSource(normalized);
    return normalized;
  } catch (error) {
    const canTrySupabaseSessionPooler =
      normalized.host.endsWith(".pooler.supabase.com") &&
      normalized.port === "6543";
    if (!canTrySupabaseSessionPooler) {
      throw error;
    }

    const sessionPoolerSource: DecryptedDataSource = {
      ...normalized,
      port: "5432",
    };
    try {
      await testWithSource(sessionPoolerSource);
      return sessionPoolerSource;
    } catch {
      throw error;
    }
  }
}

function isReadOnlySql(sql: string): boolean {
  const trimmed = sql.trim();
  const hasSemicolon = trimmed.includes(";");
  if (hasSemicolon && !trimmed.endsWith(";")) return false;

  const withoutTrailing = trimmed.replace(/;+\s*$/, "");
  if (!withoutTrailing) return false;

  const startsReadOnly =
    /^(select|with)\s/i.test(withoutTrailing);
  if (!startsReadOnly) return false;

  // Guard obvious dangerous keywords/functions.
  const blocked = /\b(insert|update|delete|drop|alter|create|grant|revoke|truncate|copy|pg_read_file|pg_write_file|dblink)\b/i;
  if (blocked.test(withoutTrailing)) return false;
  return true;
}

async function runReadOnly(
  client: PoolClient,
  sql: string,
  policy: SqlPolicy
): Promise<QueryResult<Record<string, unknown>>> {
  await client.query("BEGIN TRANSACTION READ ONLY");
  try {
    await client.query(`SET LOCAL statement_timeout = '${policy.statementTimeoutMs}ms'`);
    const normalized = sql.trim().replace(/;+\s*$/, "");
    const cappedSql = `SELECT * FROM (${normalized}) AS vox_result LIMIT ${policy.rowCap}`;
    const result = await client.query(cappedSql);
    await client.query("COMMIT");
    return result as QueryResult<Record<string, unknown>>;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function executeReadOnlySql(
  source: DecryptedDataSource,
  sql: string,
  policy: Partial<SqlPolicy> = {}
) {
  const effectivePolicy = { ...DEFAULT_POLICY, ...policy };
  if (!isReadOnlySql(sql)) {
    throw new Error("SQL blocked by policy: only single read-only SELECT/CTE statements are allowed.");
  }

  const pool = getPool(source);
  const client = await pool.connect();
  try {
    const startedAt = Date.now();
    const result = await runReadOnly(client, sql, effectivePolicy);
    const latencyMs = Date.now() - startedAt;
    return {
      rows: result.rows,
      columns: result.fields.map((f) => f.name),
      rowCount: result.rowCount ?? result.rows.length,
      latencyMs,
      rowCap: effectivePolicy.rowCap,
    };
  } finally {
    client.release();
  }
}
