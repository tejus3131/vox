import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/chat/workspace";
import type { ChatMessage, ChatSession, QueryRun } from "@/types";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ dbId: string; chatId: string }>;
}) {
  const { dbId, chatId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const ownershipCheck = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", chatId)
    .eq("user_id", user.id)
    .eq("data_source_id", dbId)
    .single();

  if (!ownershipCheck.data) {
    redirect(`/${dbId}`);
  }

  const [chatsResp, messagesResp] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("id, user_id, data_source_id, title, archived, last_message_at, created_at, updated_at")
      .eq("user_id", user.id)
      .eq("data_source_id", dbId)
      .eq("archived", false)
      .order("last_message_at", { ascending: false }),
    supabase
      .from("chat_messages")
      .select("*")
      .eq("chat_session_id", chatId)
      .order("created_at", { ascending: true }),
  ]);

  const messageIds = (messagesResp.data ?? []).map((m) => m.id);
  const queryRunsResp =
    messageIds.length === 0
      ? { data: [] as QueryRun[] }
      : await supabase
          .from("query_runs")
          .select("*")
          .in("chat_message_id", messageIds)
          .order("attempt_index", { ascending: true });

  const queryRunsByMessage: Record<string, QueryRun[]> = {};
  for (const run of queryRunsResp.data ?? []) {
    const key = String(run.chat_message_id);
    queryRunsByMessage[key] = queryRunsByMessage[key] ?? [];
    queryRunsByMessage[key].push(run as QueryRun);
  }

  return (
    <Workspace
      dbId={dbId}
      activeChatId={chatId}
      initialChats={(chatsResp.data ?? []) as ChatSession[]}
      initialMessages={(messagesResp.data ?? []) as ChatMessage[]}
      initialQueryRunsByMessage={queryRunsByMessage}
    />
  );
}
