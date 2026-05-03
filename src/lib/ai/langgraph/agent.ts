import { tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { executeReadOnlySql } from "@/lib/db/connection-manager";
import type { DecryptedDataSource } from "@/types";
import { validateSql } from "@/lib/ai/security/sql-policy";
import { SAFETY_PROMPT, wrapUserInput } from "@/lib/ai/security/prompt-defense";
import { classifyError } from "@/lib/ai/errors";

const MAX_FIX_RETRIES = 3;

const SYSTEM_PROMPT = `${SAFETY_PROMPT}

You are Vox — a sharp, approachable data expert who helps users explore and understand their data.

## Workflow (follow strictly)

1. **Schema first** — Before writing ANY query, call get_schema_info to learn the available tables and columns. Never guess table or column names.
2. **Sample when uncertain** — If a table's data shape, value formats, or enums are unclear, call get_table_sample to inspect real rows before building filters or joins.
3. **Query with intent** — Only after you understand the structure should you call execute_sql. Every query must have a clear purpose tied to the user's question.
4. **Charts via SQL first** — If user asks for chart/graph/plot/visualization, you must still execute SQL to fetch structured data. Do not say you cannot generate charts; Vox UI renders charts/tables from your query results.

## Guardrails

- **Read-only** — You can only run SELECT statements. Never attempt INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, or any DDL/DML.
- **No blind queries** — Never run SELECT * on a large table without a LIMIT. Default to LIMIT 100 unless the user explicitly asks for more.
- **Validate references** — Only reference tables and columns that exist in the schema you retrieved.
- **Fail gracefully** — If a query errors, explain what went wrong and suggest a fix rather than silently retrying.
- **Anti-hallucination** — When presenting results, ONLY reference numbers and facts that appear in the actual query results. Never invent or extrapolate data.

## Response style

- Lead with the insight, not the SQL. Users care about what the data means.
- When showing numbers, add context (percentages, comparisons, trends) where it helps.
- Keep explanations concise — a few clear sentences beat a wall of text.
- If the user's question is vague, ask a focused clarifying question.
- When you surface query results, briefly describe what the query did so the user can verify your reasoning.
`;

export function createSqlAgent(source: DecryptedDataSource, getSchema: () => Promise<string>) {
  const llm = new ChatOpenAI({
    apiKey: process.env.LLM_API_KEY,
    configuration: { baseURL: process.env.LLM_BASE_URL },
    model: process.env.LLM_MODEL ?? "gpt-4o-mini",
    temperature: 0,
  });

  const schemaTool = tool(
    async () => await getSchema(),
    {
      name: "get_schema_info",
      description: "Return schema details for connected database.",
      schema: z.object({}),
    }
  );

  const sampleTool = tool(
    async ({ tableName }) => {
      const sanitized = tableName.replace(/[^a-zA-Z0-9_]/g, "");
      const sql = `SELECT * FROM "${sanitized}" LIMIT 3`;
      const validation = validateSql(sql);
      if (!validation.valid) {
        return JSON.stringify({ error: validation.reason });
      }
      const result = await executeReadOnlySql(source, sql, { rowCap: 3 });
      return JSON.stringify({ columns: result.columns, rows: result.rows }, null, 2);
    },
    {
      name: "get_table_sample",
      description: "Fetch up to 3 rows from a table.",
      schema: z.object({ tableName: z.string() }),
    }
  );

  const sqlTool = tool(
    async ({ query }) => {
      const validation = validateSql(query);
      if (!validation.valid) {
        return JSON.stringify({
          error: `Query blocked by safety policy: ${validation.reason}`,
          code: "sql_blocked",
        });
      }

      let lastError: string | undefined;
      for (let attempt = 0; attempt < MAX_FIX_RETRIES; attempt++) {
        try {
          const result = await executeReadOnlySql(source, query);
          return JSON.stringify(
            { rowCount: result.rowCount, columns: result.columns, rows: result.rows },
            null,
            2
          );
        } catch (err) {
          const classified = classifyError(err);
          lastError = classified.userMessage;

          if (!classified.retryable || attempt === MAX_FIX_RETRIES - 1) {
            return JSON.stringify({
              error: classified.userMessage,
              code: classified.code,
            });
          }
        }
      }

      return JSON.stringify({
        error: lastError ?? "Query failed after retries",
        code: "sql_generation_failed",
      });
    },
    {
      name: "execute_sql",
      description: "Execute read-only SQL query. Query is validated against safety policy before execution.",
      schema: z.object({ query: z.string() }),
    }
  );

  return createReactAgent({
    llm,
    tools: [schemaTool, sampleTool, sqlTool],
    prompt: SYSTEM_PROMPT,
  });
}

export function prepareUserMessage(content: string): string {
  return wrapUserInput(content);
}

function normalizeModelText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          const text = (part as { text?: unknown }).text;
          return typeof text === "string" ? text : "";
        }
        return "";
      })
      .join(" ")
      .trim();
  }
  return "";
}

function sanitizeChatTitle(raw: string): string {
  const collapsed = raw
    .replace(/\r?\n/g, " ")
    .replace(/["'`]/g, "")
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = collapsed.split(" ").filter(Boolean).slice(0, 6);
  const limited = words.join(" ").slice(0, 60).trim();
  return limited || "New Chat";
}

function fallbackTitle(firstUserMessage: string): string {
  const cleaned = firstUserMessage
    .replace(/\r?\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "New Chat";
  const words = cleaned.split(" ").filter(Boolean).slice(0, 6).join(" ");
  return sanitizeChatTitle(words);
}

export async function generateChatTitle(firstUserMessage: string): Promise<string> {
  try {
    const llm = new ChatOpenAI({
      apiKey: process.env.LLM_API_KEY,
      configuration: { baseURL: process.env.LLM_BASE_URL },
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 20,
    });

    const response = await llm.invoke([
      { role: "system", content: "Generate a concise 3-6 word chat title. No punctuation. Never include lists or explanations." },
      { role: "user", content: firstUserMessage },
    ]);
    const content = normalizeModelText(response.content);
    return sanitizeChatTitle(content) || fallbackTitle(firstUserMessage);
  } catch {
    return fallbackTitle(firstUserMessage);
  }
}
