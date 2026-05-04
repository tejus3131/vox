import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SourceSelector } from "@/components/dashboard/source-selector";
import type { DataSource } from "@/types";
import { getOrgMembership } from "@/lib/org/membership";

export default async function OrgDashboard({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}`);
  }

  const supabase = await createClient();
  let query = supabase
    .from("data_sources")
    .select("id, user_id, name, db_type, status, created_at, updated_at, last_tested_at")
    .eq("org_id", membership.org.id)
    .order("updated_at", { ascending: false });

  if (membership.role === "member") {
    const { data: grants } = await supabase
      .from("data_source_access")
      .select("data_source_id")
      .eq("org_id", membership.org.id)
      .eq("user_id", membership.session.user.id);
    const ids = (grants ?? []).map((g) => String(g.data_source_id));
    if (ids.length > 0) {
      query = query.in("id", ids);
    } else {
      query = query.in("id", ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  const { data } = await query;
  return (
    <SourceSelector
      initialSources={(data ?? []) as DataSource[]}
      orgSlug={membership.org.id}
      orgId={membership.org.id}
      canManage={membership.role !== "member"}
      canAccessSettings={membership.role !== "member"}
    />
  );
}
