import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import {
  insertDataSource,
  listDataSources,
} from "@/lib/db/repositories";
import {
  testDataSourceConnection,
} from "@/lib/db/connection-manager";
import type { DecryptedDataSource } from "@/types";

export const dynamic = "force-dynamic";

const createSourceSchema = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  port: z.string().default("5432"),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  org_id: z.string().min(1).optional(),
});

type RawSourceInput = z.input<typeof createSourceSchema> & {
  connectionString?: string;
};

function extractConnectionString(input: string): string {
  const trimmed = input.trim();
  const matched = trimmed.match(/postgres(?:ql)?:\/\/\S+/i);
  if (!matched?.[0]) {
    throw new Error("Invalid PostgreSQL connection string");
  }
  return matched[0].replace(/[),.;]+$/, "");
}

function parseConnectionString(input: string) {
  const connectionString = extractConnectionString(input);
  const normalized = connectionString.startsWith("postgres://")
    ? connectionString.replace("postgres://", "postgresql://")
    : connectionString;
  const url = new URL(normalized);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Only PostgreSQL connection strings are supported");
  }

  const rawDb = url.pathname.replace(/^\/+/, "");
  const database = decodeURIComponent(rawDb.split(/[/?#\s]/)[0] || "postgres");
  return {
    host: url.hostname,
    port: url.port || "5432",
    database,
    username: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  };
}

function normalizeInput(raw: RawSourceInput): RawSourceInput {
  if (typeof raw.connectionString === "string" && raw.connectionString.includes("://")) {
    return { ...raw, ...parseConnectionString(raw.connectionString) };
  }
  if (typeof raw.host === "string" && raw.host.includes("://")) {
    return { ...raw, ...parseConnectionString(raw.host) };
  }
  return raw;
}

function formatZodError(err: z.ZodError): string {
  const flatten = err.flatten();
  const messages = Object.values(flatten.fieldErrors)
    .flat()
    .filter(Boolean);
  if (messages.length > 0) return messages.join("; ");
  return flatten.formErrors.join("; ") || "Invalid input";
}

export async function GET() {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { data, error } = await listDataSources(supabase, user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data_sources: data ?? [] });
}

export async function POST(request: Request) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) {
    return gate.response;
  }

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const rawBody = (await request.json()) as RawSourceInput;
  const normalizedBody = normalizeInput(rawBody);
  const parsed = createSourceSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error), details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const body = parsed.data;
  if (body.org_id) {
    const fullOrg = await auth.api.getFullOrganization({
      headers: await headers(),
      query: { organizationId: body.org_id },
    });
    const role = fullOrg?.members.find((m) => m.userId === user.id)?.role;
    if (!role || role === "member") {
      return NextResponse.json({ error: "Only org admins can add databases" }, { status: 403 });
    }
  }

  const tempSource: DecryptedDataSource = {
    id: "tmp",
    name: body.name,
    db_type: "postgresql",
    host: body.host,
    port: body.port,
    database: body.database,
    username: body.username,
    password: body.password,
  };

  let validatedSource = tempSource;
  try {
    validatedSource = await testDataSourceConnection(tempSource);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 400 }
    );
  }

  const payload = {
    user_id: user.id,
    org_id: body.org_id ?? null,
    name: body.name,
    db_type: "postgresql",
    encrypted_host: encrypt(validatedSource.host),
    encrypted_port: encrypt(validatedSource.port),
    encrypted_database: encrypt(validatedSource.database),
    encrypted_username: encrypt(validatedSource.username),
    encrypted_password: encrypt(validatedSource.password),
    status: "active",
    last_tested_at: new Date().toISOString(),
  };

  const { data, error } = await insertDataSource(supabase, payload);
  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create data source" }, { status: 500 });
  }

  return NextResponse.json({
    data_source: {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      db_type: data.db_type,
      status: data.status,
      created_at: data.created_at,
      updated_at: data.updated_at,
      last_tested_at: data.last_tested_at,
    },
  });
}
