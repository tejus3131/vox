import type { DecryptedDataSource } from "@/types";
import { Pool, type PoolClient, type QueryResult } from "pg";

interface SqlPolicy {
  statementTimeoutMs: number;
  rowCap: number;
}

const DEFAULT_POLICY: SqlPolicy = {
  statementTimeoutMs: 10_000,
  rowCap: 200,
};

const pools = new Map<string, Pool>();

function keyForSource(source: DecryptedDataSource): string {
  return `${source.host}:${source.port}:${source.database}:${source.username}`;
}

function getPool(source: DecryptedDataSource): Pool {
  const key = keyForSource(source);
  const existing = pools.get(key);
  if (existing) return existing;

  const pool = new Pool({
    host: source.host,
    port: Number(source.port || "5432"),
    database: source.database,
    user: source.username,
    password: source.password,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  pools.set(key, pool);
  return pool;
}

export async function testDataSourceConnection(source: DecryptedDataSource): Promise<void> {
  const pool = getPool(source);
  const client = await pool.connect();
  try {
    await client.query("SELECT 1");
  } finally {
    client.release();
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
