import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "@/components/chat/workspace";
import type { ChatSession } from "@/types";
import { canAccessDataSource, getOrgMembership } from "@/lib/org/membership";

export default async function OrgDatabasePage({
  params,
}: {
  params: Promise<{ orgSlug: string; dbId: string }>;
}) {
  const { orgSlug: orgKey, dbId } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/${dbId}`);
  }

  const supabase = await createClient();
  const source = await supabase
    .from("data_sources")
    .select("id")
    .eq("id", dbId)
    .eq("org_id", membership.org.id)
    .single();
  if (source.error || !source.data) redirect(`/${membership.org.id}`);

  const allowed = await canAccessDataSource({
    orgId: membership.org.id,
    userId: membership.session.user.id,
    role: membership.role,
    dataSourceId: dbId,
  });
  if (!allowed) redirect(`/${membership.org.id}`);

  const chatsResp = await supabase
    .from("chat_sessions")
    .select("id, user_id, org_id, data_source_id, title, archived, last_message_at, created_at, updated_at")
    .eq("org_id", membership.org.id)
    .eq("data_source_id", dbId)
    .eq("archived", false)
    .eq("user_id", membership.session.user.id)
    .order("last_message_at", { ascending: false });

  return (
    <Workspace
      orgId={membership.org.id}
      dbId={dbId}
      activeChatId={null}
      initialChats={(chatsResp.data ?? []) as ChatSession[]}
      initialMessages={[]}
      initialQueryRunsByMessage={{}}
    />
  );
}
