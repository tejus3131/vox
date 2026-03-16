import { randomUUID } from "node:crypto";
import { decrypt } from "@/lib/crypto";
import type { DecryptedDataSource, StreamEvent } from "@/types";
import {
  countUserMessages,
  createChatMessage,
  createQueryRun,
  getChatSessionById,
  getDataSourceById,
  listRecentChatMessages,
  touchChatSession,
  updateChatMessage,
  updateDataSource,
  updateChatSession,
} from "@/lib/db/repositories";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSqlAgent, generateChatTitle } from "./agent";
import { introspectSchema } from "@/lib/db/schema-introspection";
import { isQueryExecutionEnabled } from "@/lib/app-runtime";

type QueryRouteInput =
  { chatId: string; query: string; requestId?: string };

interface QueryRouteOutput {
  stream: ReadableStream<Uint8Array>;
}

function mapSourceRowToDecrypted(row: Record<string, unknown>): DecryptedDataSource {
  return {
    id: String(row.id),
    name: String(row.name),
    db_type: "postgresql",
    host: decrypt(String(row.encrypted_host)),
    port: decrypt(String(row.encrypted_port)),
    database: decrypt(String(row.encrypted_database)),
    username: decrypt(String(row.encrypted_username)),
    password: decrypt(String(row.encrypted_password)),
  };
}

function parseAgentOutput(messages: unknown[]) {
  const attempts: Array<{ sql: string; resultPreview: Record<string, unknown>[]; columns: string[] }> = [];
  let answerText = "";
  const pendingSql: string[] = [];

  for (const msg of messages) {
    if (!msg || typeof msg !== "object") continue;
    const typed = msg as {
      type?: string;
      content?: unknown;
      tool_calls?: Array<{ name?: string; args?: Record<string, unknown> }>;
      name?: string;
    };
    if (typed.type === "ai" && typeof typed.content === "string") {
      answerText = typed.content || answerText;
    }
    if (typed.tool_calls?.length) {
      for (const call of typed.tool_calls) {
        if (call.name === "execute_sql" && call.args?.query) {
          pendingSql.push(String(call.args.query));
        }
      }
    }
    if (typed.type === "tool" && typeof typed.content === "string") {
      const sql = pendingSql.shift();
      if (!sql) continue;
      try {
        const parsed = JSON.parse(typed.content) as {
          rows?: Record<string, unknown>[];
          columns?: string[];
          rowCount?: number;
        };
        attempts.push({
          sql,
          resultPreview: Array.isArray(parsed.rows) ? parsed.rows.slice(0, 50) : [],
          columns: Array.isArray(parsed.columns) ? parsed.columns : [],
        });
      } catch {
        attempts.push({
          sql,
          resultPreview: [],
          columns: [],
        });
      }
    }
  }

  return { attempts, answerText };
}

function makeEventSender(controller: ReadableStreamDefaultController<Uint8Array>) {
  const enc = new TextEncoder();
  let sequence = 0;
  return (event: { type: StreamEvent["type"]; request_id: string } & Record<string, unknown>) => {
    sequence += 1;
    const payload = {
      ...event,
      sequence,
      timestamp: new Date().toISOString(),
    };
    controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };
}

async function resolveContext(
  supabase: SupabaseClient,
  user: User,
  input: QueryRouteInput
) {
  const chatResp = await getChatSessionById(supabase, user.id, input.chatId);
  if (chatResp.error || !chatResp.data) {
    throw new Error("Chat not found");
  }
  const sourceResp = await getDataSourceById(
    supabase,
    user.id,
    String(chatResp.data.data_source_id)
  );
  if (sourceResp.error || !sourceResp.data) {
    throw new Error("Data source not found");
  }
  return {
    chatId: String(chatResp.data.id),
    dataSourceId: String(sourceResp.data.id),
    source: mapSourceRowToDecrypted(sourceResp.data as Record<string, unknown>),
  };
}

export async function runQuery(
  supabase: SupabaseClient,
  user: User,
  input: QueryRouteInput
): Promise<QueryRouteOutput> {
  if (!isQueryExecutionEnabled()) {
    throw new Error("temporarily_unavailable");
  }

  const requestId = input.requestId || randomUUID();
  const context = await resolveContext(supabase, user, input);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = makeEventSender(controller);
      try {
        const userMessage = await createChatMessage(supabase, {
          chat_session_id: context.chatId,
          role: "user",
          content: input.query.trim(),
          status: "completed",
        });
        if (userMessage.error || !userMessage.data) {
          throw new Error("Failed to persist user message");
        }

        const userMessageCountResp = await countUserMessages(supabase, context.chatId);
        const isFirstUserMessage = Number(userMessageCountResp.count ?? 0) === 1;

        const pendingAssistant = await createChatMessage(supabase, {
          chat_session_id: context.chatId,
          role: "assistant",
          content: "",
          status: "pending",
          model: process.env.LLM_MODEL ?? "gpt-4o-mini",
        });
        if (pendingAssistant.error || !pendingAssistant.data) {
          throw new Error("Failed to pre-create assistant message");
        }

        const historyResp = await listRecentChatMessages(supabase, context.chatId, 24);
        const history = (historyResp.data ?? [])
          .reverse()
          .map((msg) => ({
            role: msg.role === "assistant" ? "assistant" : "user",
            content: msg.content,
          }));

        const agent = createSqlAgent(
          context.source,
          async () => await introspectSchema(context.source)
        );
        const result = await agent.invoke({ messages: [...history, { role: "user", content: input.query.trim() }] });
        const messages = Array.isArray((result as { messages?: unknown[] }).messages)
          ? ((result as { messages: unknown[] }).messages)
          : [];
        const { attempts, answerText } = parseAgentOutput(messages);

        // Event ordering contract for clients:
        // 1) each SQL attempt emits `sql` then `query_result_preview`
        // 2) after all attempts, emit final `text`
        // 3) optional `title_updated`
        // 4) terminal `done` as the last non-error event
        let latestQueryRunId: string | undefined;
        let idx = 0;
        for (const attempt of attempts) {
          const queryRun = await createQueryRun(supabase, {
            chat_message_id: pendingAssistant.data.id,
            attempt_index: idx,
            sql_text: attempt.sql,
            status: "ok",
            row_count: attempt.resultPreview.length,
            columns: attempt.columns,
            rows_preview: attempt.resultPreview,
            latency_ms: null,
          });
          if (!queryRun.error && queryRun.data) {
            latestQueryRunId = String(queryRun.data.id);
            send({
              type: "sql",
              request_id: requestId,
              query_run_id: String(queryRun.data.id),
              attempt_index: idx,
              sql_text: attempt.sql,
            });
            send({
              type: "query_result_preview",
              request_id: requestId,
              query_run_id: String(queryRun.data.id),
              attempt_index: idx,
              row_count: Number(queryRun.data.row_count ?? 0),
              columns: Array.isArray(queryRun.data.columns) ? queryRun.data.columns : [],
              rows_preview: Array.isArray(queryRun.data.rows_preview) ? queryRun.data.rows_preview : [],
            });
          }
          idx += 1;
        }

        const finalAnswer = answerText || "I analyzed your request.";
        send({
          type: "text",
          request_id: requestId,
          delta: finalAnswer,
        });

        const finalized = await updateChatMessage(supabase, String(pendingAssistant.data.id), {
          content: finalAnswer,
          status: "completed",
        });
        if (finalized.error || !finalized.data) {
          throw new Error("Failed to finalize assistant message");
        }

        await touchChatSession(supabase, context.chatId);

        if (isFirstUserMessage) {
          const title = await generateChatTitle(input.query.trim());
          const titleUpdate = await updateChatSession(supabase, context.chatId, user.id, {
            title,
            updated_at: new Date().toISOString(),
          });
          if (!titleUpdate.error) {
            send({
              type: "title_updated",
              request_id: requestId,
              chat_session_id: context.chatId,
              title,
            });
          }
        }

        await updateDataSource(supabase, user.id, context.dataSourceId, {
          status: "active",
          last_tested_at: new Date().toISOString(),
        });

        send({
          type: "done",
          request_id: requestId,
          chat_session_id: context.chatId,
          assistant_message_id: String(finalized.data.id),
          query_run_id: latestQueryRunId,
        });
        // `done` is terminal: no additional events after this point.
        controller.close();
      } catch (error) {
        send({
          type: "error",
          request_id: requestId,
          code: "query_failed",
          message: error instanceof Error ? error.message : "Query failed",
          retryable: true,
        });
        // `error` is terminal: close immediately after emitting.
        controller.close();
      }
    },
  });

  return { stream };
}
