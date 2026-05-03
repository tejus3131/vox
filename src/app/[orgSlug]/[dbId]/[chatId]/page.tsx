import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/chat/workspace";
import type { ChatMessage, ChatSession, QueryRun } from "@/types";
import { canAccessDataSource, getOrgMembership } from "@/lib/org/membership";

export default async function OrgChatPage({
  params,
}: {
  params: Promise<{ orgSlug: string; dbId: string; chatId: string }>;
}) {
  const { orgSlug: orgKey, dbId, chatId } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/${dbId}/${chatId}`);
  }

  const allowed = await canAccessDataSource({
    orgId: membership.org.id,
    userId: membership.session.user.id,
    role: membership.role,
    dataSourceId: dbId,
  });
  if (!allowed) redirect(`/${membership.org.id}`);

  const supabase = await createClient();
  const ownershipCheck = await supabase
    .from("chat_sessions")
    .select("id")
    .eq("id", chatId)
    .eq("org_id", membership.org.id)
    .eq("data_source_id", dbId)
    .eq("user_id", membership.session.user.id)
    .single();

  if (!ownershipCheck.data) {
    redirect(`/${membership.org.id}/${dbId}`);
  }

  const [chatsResp, messagesResp] = await Promise.all([
    supabase
      .from("chat_sessions")
      .select("id, user_id, org_id, data_source_id, title, archived, last_message_at, created_at, updated_at")
      .eq("org_id", membership.org.id)
      .eq("data_source_id", dbId)
      .eq("archived", false)
      .eq("user_id", membership.session.user.id)
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
      orgId={membership.org.id}
      dbId={dbId}
      activeChatId={chatId}
      initialChats={(chatsResp.data ?? []) as ChatSession[]}
      initialMessages={(messagesResp.data ?? []) as ChatMessage[]}
      initialQueryRunsByMessage={queryRunsByMessage}
    />
  );
}
