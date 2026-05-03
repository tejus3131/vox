export type DataSourceStatus = "active" | "invalid" | "disabled";

export interface DataSource {
  id: string;
  user_id: string;
  name: string;
  db_type: "postgresql";
  status: DataSourceStatus;
  created_at: string;
  updated_at: string;
  last_tested_at: string | null;
}

export interface DecryptedDataSource {
  id: string;
  name: string;
  db_type: "postgresql";
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  org_id: string | null;
  data_source_id: string;
  title: string;
  archived: boolean;
  last_message_at: string;
  created_at: string;
  updated_at: string;
}

export type MessageRole = "user" | "assistant" | "system";
export type MessageStatus = "pending" | "completed" | "error";

export interface ChatMessage {
  id: string;
  chat_session_id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model: string | null;
  token_usage: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  created_at: string;
  parent_message_id?: string | null;
  branch_index?: number;
  is_active?: boolean;
}

export type QueryRunStatus = "ok" | "error" | "blocked" | "timeout";

export interface QueryRun {
  id: string;
  chat_message_id: string;
  attempt_index: number;
  sql_text: string;
  status: QueryRunStatus;
  row_count: number;
  columns: string[] | null;
  rows_preview: Record<string, unknown>[] | null;
  latency_ms: number | null;
  error_text: string | null;
  created_at: string;
}

export type StreamEventType =
  | "title_updated"
  | "text"
  | "sql"
  | "query_result_preview"
  | "error"
  | "done";

interface StreamBaseEvent {
  type: StreamEventType;
  request_id: string;
  timestamp: string;
  sequence: number;
}

export interface StreamTextEvent extends StreamBaseEvent {
  type: "text";
  delta: string;
}

export interface StreamTitleUpdatedEvent extends StreamBaseEvent {
  type: "title_updated";
  chat_session_id: string;
  title: string;
}

export interface StreamSqlEvent extends StreamBaseEvent {
  type: "sql";
  query_run_id: string;
  attempt_index: number;
  sql_text: string;
}

export interface StreamQueryResultPreviewEvent extends StreamBaseEvent {
  type: "query_result_preview";
  query_run_id: string;
  attempt_index: number;
  row_count: number;
  columns: string[];
  rows_preview: Record<string, unknown>[];
}

export interface StreamErrorEvent extends StreamBaseEvent {
  type: "error";
  code: string;
  message: string;
  retryable: boolean;
  query_run_id?: string;
}

export interface StreamDoneEvent extends StreamBaseEvent {
  type: "done";
  chat_session_id: string;
  assistant_message_id: string;
  query_run_id?: string;
}

export type StreamEvent =
  | StreamTitleUpdatedEvent
  | StreamTextEvent
  | StreamSqlEvent
  | StreamQueryResultPreviewEvent
  | StreamErrorEvent
  | StreamDoneEvent;
