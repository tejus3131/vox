import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/chat/workspace";
import type { ChatSession } from "@/types";

export default async function DatabasePage({
  params,
}: {
  params: Promise<{ dbId: string }>;
}) {
  const { dbId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const source = await supabase
    .from("data_sources")
    .select("id")
    .eq("id", dbId)
    .eq("user_id", user.id)
    .single();
  if (source.error || !source.data) redirect("/");

  const chatsResp = await supabase
    .from("chat_sessions")
    .select("id, user_id, data_source_id, title, archived, last_message_at, created_at, updated_at")
    .eq("user_id", user.id)
    .eq("data_source_id", dbId)
    .eq("archived", false)
    .order("last_message_at", { ascending: false });

  return (
    <Workspace
      dbId={dbId}
      activeChatId={null}
      initialChats={(chatsResp.data ?? []) as ChatSession[]}
      initialMessages={[]}
      initialQueryRunsByMessage={{}}
    />
  );
}
