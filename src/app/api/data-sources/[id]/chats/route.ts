import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import {
  createChatSession,
  getDataSourceById,
  listChatSessions,
} from "@/lib/db/repositories";

const createChatSchema = z.object({
  title: z.string().min(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;
  const { id } = await params;

  const source = await getDataSourceById(supabase, user.id, id);
  if (source.error || !source.data) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  const { data, error } = await listChatSessions(supabase, user.id, id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ chat_sessions: data ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;
  const { id } = await params;

  const source = await getDataSourceById(supabase, user.id, id);
  if (source.error || !source.data) {
    return NextResponse.json({ error: "Data source not found" }, { status: 404 });
  }

  const parsed = createChatSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await createChatSession(supabase, {
    user_id: user.id,
    data_source_id: id,
    title: parsed.data.title ?? "New Chat",
    archived: false,
    last_message_at: new Date().toISOString(),
  });

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create chat session" }, { status: 500 });
  }

  return NextResponse.json({ chat_session: data });
}
