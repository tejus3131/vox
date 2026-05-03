export type QueryErrorCode =
  | "db_unreachable"
  | "db_auth_failed"
  | "query_timeout"
  | "sql_blocked"
  | "sql_generation_failed"
  | "sql_syntax_error"
  | "rate_limited"
  | "quota_exceeded"
  | "internal_error";

interface ClassifiedError {
  code: QueryErrorCode;
  userMessage: string;
  retryable: boolean;
}

export function classifyError(error: unknown): ClassifiedError {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes("econnrefused") || lower.includes("etimedout") || lower.includes("enotfound")) {
    return {
      code: "db_unreachable",
      userMessage: "Your database is unreachable. Please check that it's running and accessible.",
      retryable: false,
    };
  }

  if (lower.includes("password authentication failed") || lower.includes("no pg_hba.conf")) {
    return {
      code: "db_auth_failed",
      userMessage: "Database authentication failed. Please verify your credentials.",
      retryable: false,
    };
  }

  if (lower.includes("statement timeout") || lower.includes("canceling statement due to statement timeout")) {
    return {
      code: "query_timeout",
      userMessage: "Query timed out. Try adding filters or simplifying your question.",
      retryable: true,
    };
  }

  if (lower.includes("blocked") || lower.includes("policy violation") || lower.includes("not allowed")) {
    return {
      code: "sql_blocked",
      userMessage: "This query was blocked by our safety policy. Only read-only queries are allowed.",
      retryable: false,
    };
  }

  if (lower.includes("syntax error")) {
    return {
      code: "sql_syntax_error",
      userMessage: "Generated SQL had a syntax error. Retrying...",
      retryable: true,
    };
  }

  if (lower.includes("rate limit")) {
    return {
      code: "rate_limited",
      userMessage: "Rate limit reached. Please wait a moment before trying again.",
      retryable: true,
    };
  }

  if (lower.includes("quota") || lower.includes("trial expired") || lower.includes("billing")) {
    return {
      code: "quota_exceeded",
      userMessage: "Your usage quota has been exceeded. Please check your billing settings.",
      retryable: false,
    };
  }

  return {
    code: "internal_error",
    userMessage: "Something went wrong on our end. We've been notified and are looking into it.",
    retryable: false,
  };
}
