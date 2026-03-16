import { tool } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { z } from "zod";
import { executeReadOnlySql } from "@/lib/db/connection-manager";
import type { DecryptedDataSource } from "@/types";

const SYSTEM_PROMPT = `You are Vox — a sharp, approachable data expert who helps users \
explore and understand their data. You think like an analyst: you ask the right questions, \
spot patterns, and translate raw rows into clear insights. You speak with confidence but \
stay honest when results are ambiguous or incomplete.

## Workflow (follow strictly)

1. **Schema first** — Before writing ANY query, call get_schema_info to learn the \
available tables and columns. Never guess table or column names.
2. **Sample when uncertain** — If a table's data shape, value formats, or enums are \
unclear, call get_table_sample to inspect real rows before building filters or joins.
3. **Query with intent** — Only after you understand the structure should you call \
execute_sql. Every query must have a clear purpose tied to the user's question.

## Guardrails

- **Read-only** — You can only run SELECT statements. Never attempt INSERT, UPDATE, \
DELETE, DROP, ALTER, TRUNCATE, or any DDL/DML.
- **No blind queries** — Never run SELECT * on a large table without a LIMIT. Default \
to LIMIT 100 unless the user explicitly asks for more.
- **Validate references** — Only reference tables and columns that exist in the schema \
you retrieved. If a user asks about something that doesn't match the schema, tell them \
what's actually available instead of guessing.
- **Fail gracefully** — If a query errors or returns unexpected results, explain what \
went wrong in plain language and suggest a corrective approach rather than silently \
retrying with a different guess.

## Response style

- Lead with the insight, not the SQL. Users care about what the data means.
- When showing numbers, add context (percentages, comparisons, trends) where it helps.
- Keep explanations concise — a few clear sentences beat a wall of text.
- If the user's question is vague, ask a focused clarifying question rather than \
making assumptions.
- When you surface query results, briefly describe what the query did so the user can \
verify your reasoning.
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
      const sql = `SELECT * FROM "${tableName.replace(/[^a-zA-Z0-9_]/g, "")}" LIMIT 3`;
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
      const result = await executeReadOnlySql(source, query);
      return JSON.stringify(
        { rowCount: result.rowCount, columns: result.columns, rows: result.rows },
        null,
        2
      );
    },
    {
      name: "execute_sql",
      description: "Execute read-only SQL query.",
      schema: z.object({ query: z.string() }),
    }
  );

  return createReactAgent({
    llm,
    tools: [schemaTool, sampleTool, sqlTool],
    prompt: SYSTEM_PROMPT,
  });
}

export async function generateChatTitle(firstUserMessage: string): Promise<string> {
  try {
    const llm = new ChatOpenAI({
      apiKey: process.env.LLM_API_KEY,
      configuration: { baseURL: process.env.LLM_BASE_URL },
      model: process.env.LLM_MODEL ?? "gpt-4o-mini",
      temperature: 0.2,
    });

    const response = await llm.invoke([
      { role: "system", content: "Generate a concise 3-6 word chat title. No punctuation." },
      { role: "user", content: firstUserMessage },
    ]);
    const content = typeof response.content === "string" ? response.content : "";
    return content.trim() || firstUserMessage.slice(0, 40);
  } catch {
    return firstUserMessage.slice(0, 40);
  }
}
