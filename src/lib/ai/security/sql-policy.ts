export const ALLOWED_FUNCTIONS = new Set([
  "count", "sum", "avg", "min", "max", "array_agg", "string_agg",
  "lower", "upper", "trim", "substring", "length", "concat", "replace",
  "now", "current_date", "current_timestamp", "date_trunc", "extract", "age",
  "cast", "coalesce", "nullif",
  "case", "greatest", "least",
  "abs", "ceil", "floor", "round", "trunc",
  "to_char", "to_date", "to_timestamp", "to_number",
  "left", "right", "lpad", "rpad", "repeat", "reverse",
  "position", "strpos", "regexp_replace", "regexp_match",
  "dense_rank", "rank", "row_number", "lag", "lead",
  "first_value", "last_value", "nth_value",
  "percentile_cont", "percentile_disc",
  "bool_and", "bool_or", "every",
  "generate_series",
]);

export const BLOCKED_FUNCTIONS = new Set([
  "pg_read_file", "pg_write_file", "pg_ls_dir",
  "dblink", "dblink_exec", "dblink_connect",
  "lo_import", "lo_export", "lo_create",
  "copy", "pg_sleep",
  "set_config", "current_setting",
  "pg_terminate_backend", "pg_cancel_backend",
  "pg_reload_conf",
  "inet_server_addr", "inet_server_port",
  "pg_stat_activity",
  "pg_advisory_lock", "pg_advisory_unlock",
  "txid_current", "txid_snapshot_xmin",
]);

export const BLOCKED_KEYWORDS = [
  "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
  "CREATE", "GRANT", "REVOKE", "VACUUM", "REINDEX",
  "COMMENT", "SECURITY", "OWNER",
  "EXECUTE", "PREPARE", "DEALLOCATE",
  "LISTEN", "NOTIFY", "UNLISTEN",
  "CLUSTER", "DISCARD", "RESET",
  "SET ROLE", "SET SESSION",
  "COPY ",
];

export interface SqlValidationResult {
  valid: boolean;
  reason?: string;
  blockedFunction?: string;
  blockedKeyword?: string;
}

export function validateSql(sql: string): SqlValidationResult {
  const upper = sql.toUpperCase().trim();

  for (const keyword of BLOCKED_KEYWORDS) {
    if (upper.startsWith(keyword) || upper.includes(`\n${keyword}`) || upper.includes(`;${keyword}`) || upper.includes(` ${keyword} `)) {
      if (keyword === "COPY " && upper.startsWith("SELECT")) continue;
      return {
        valid: false,
        reason: `Blocked SQL operation: ${keyword.trim()}`,
        blockedKeyword: keyword.trim(),
      };
    }
  }

  const funcRegex = /([a-z_][a-z0-9_]*)\s*\(/gi;
  let match;
  while ((match = funcRegex.exec(sql)) !== null) {
    const fn = match[1].toLowerCase();
    if (BLOCKED_FUNCTIONS.has(fn)) {
      return {
        valid: false,
        reason: `Blocked function: ${fn}`,
        blockedFunction: fn,
      };
    }
  }

  if ((sql.match(/;/g) || []).length > 1) {
    return {
      valid: false,
      reason: "Multiple statements not allowed",
    };
  }

  return { valid: true };
}
