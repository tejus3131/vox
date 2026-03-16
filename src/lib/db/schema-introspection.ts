import type { DecryptedDataSource } from "@/types";
import { executeReadOnlySql } from "@/lib/db/connection-manager";

export async function introspectSchema(source: DecryptedDataSource): Promise<string> {
  const tables = await executeReadOnlySql(
    source,
    `SELECT table_name
     FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
     ORDER BY table_name`,
    { rowCap: 500 }
  );

  const parts: string[] = [];
  for (const row of tables.rows) {
    const tableName = String(row.table_name);
    const cols = await executeReadOnlySql(
      source,
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${tableName.replace(/'/g, "''")}'
       ORDER BY ordinal_position`,
      { rowCap: 200 }
    );
    parts.push(
      `${tableName}: ${cols.rows
        .map((c) => `${String(c.column_name)}(${String(c.data_type)}, nullable=${String(c.is_nullable)})`)
        .join(", ")}`
    );
  }

  return parts.join("\n");
}
