import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api/auth";
import { runQuery } from "@/lib/ai/langgraph/query-service";

const editSchema = z.object({
  content: z.string().min(1),
  request_id: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ chatId: string; messageId: string }> }
) {
  const { supabase, user, unauthorized } = await requireUser();
  if (!user) return unauthorized!;

  const { chatId, messageId } = await params;
  const parsed = editSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { content } = parsed.data;

  const originalMsg = await supabase
    .from("chat_messages")
    .select("*")
    .eq("id", messageId)
    .eq("chat_session_id", chatId)
    .single();

  if (!originalMsg.data) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const original = originalMsg.data;
  if (original.role !== "user") {
    return NextResponse.json({ error: "Can only edit user messages" }, { status: 400 });
  }

  await supabase
    .from("chat_messages")
    .update({ is_active: false })
    .eq("chat_session_id", chatId)
    .eq("is_active", true)
    .gte("created_at", original.created_at);

  const { data: siblings } = await supabase
    .from("chat_messages")
    .select("branch_index")
    .eq("parent_message_id", original.parent_message_id ?? messageId)
    .order("branch_index", { ascending: false })
    .limit(1);

  const nextBranch = ((siblings?.[0]?.branch_index as number) ?? 0) + 1;

  const { data: newMsg } = await supabase
    .from("chat_messages")
    .insert({
      chat_session_id: chatId,
      role: "user",
      content,
      status: "completed",
      parent_message_id: original.parent_message_id ?? messageId,
      branch_index: nextBranch,
      is_active: true,
    })
    .select("*")
    .single();

  if (!newMsg) {
    return NextResponse.json({ error: "Failed to create edited message" }, { status: 500 });
  }

  const output = await runQuery(supabase, user, {
    chatId,
    query: content,
    requestId: parsed.data.request_id,
  });

  return new Response(output.stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-New-Message-Id": String(newMsg.id),
    },
  });
}
