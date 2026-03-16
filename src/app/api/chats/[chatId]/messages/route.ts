import { NextResponse } from "next/server";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import {
  getChatSessionById,
  listChatMessages,
  listQueryRunsForMessages,
} from "@/lib/db/repositories";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { chatId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Number(searchParams.get("limit")) || 100, 500);

  const session = await getChatSessionById(supabase, user.id, chatId);
  if (session.error || !session.data) {
    return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
  }

  const { data, error } = await listChatMessages(supabase, chatId, limit);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const messageIds = (data ?? []).map((m) => m.id);
  const queryRunsResp = await listQueryRunsForMessages(supabase, messageIds);
  const queryRunsByMessage: Record<string, unknown[]> = {};
  for (const run of queryRunsResp.data ?? []) {
    const key = String(run.chat_message_id);
    queryRunsByMessage[key] = queryRunsByMessage[key] ?? [];
    queryRunsByMessage[key].push(run);
  }

  return NextResponse.json({
    chat_session: session.data,
    messages: data ?? [],
    query_runs_by_message: queryRunsByMessage,
  });
}
