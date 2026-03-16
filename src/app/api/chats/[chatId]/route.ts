import { NextResponse } from "next/server";
import { ensureSchemaCompatibility } from "@/lib/app-runtime";
import { requireUser } from "@/lib/api/auth";
import {
  archiveChatSession,
  getChatSessionById,
} from "@/lib/db/repositories";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const gate = await ensureSchemaCompatibility();
  if (!gate.ok) return gate.response;

  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { chatId } = await params;
  const session = await getChatSessionById(supabase, user.id, chatId);
  if (session.error || !session.data) {
    return NextResponse.json({ error: "Chat session not found" }, { status: 404 });
  }

  const { error } = await archiveChatSession(supabase, user.id, chatId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
