import { NextResponse } from "next/server";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
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
});

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

  const parsed = createSourceSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const body = parsed.data;
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

  try {
    await testDataSourceConnection(tempSource);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Connection failed" },
      { status: 400 }
    );
  }

  const payload = {
    user_id: user.id,
    name: body.name,
    db_type: "postgresql",
    encrypted_host: encrypt(body.host),
    encrypted_port: encrypt(body.port),
    encrypted_database: encrypt(body.database),
    encrypted_username: encrypt(body.username),
    encrypted_password: encrypt(body.password),
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
