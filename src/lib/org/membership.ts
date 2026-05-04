import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "member";

export async function getOrgMembership(orgKey: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  const orgs = await auth.api.listOrganizations({ headers: await headers() });
  const org = (orgs ?? []).find((o) => o.id === orgKey || o.slug === orgKey);
  if (!org) return null;

  const fullOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: org.id },
  });
  const member = fullOrg?.members.find((m) => m.userId === session.user.id);
  if (!member) return null;

  return {
    session,
    org,
    role: member.role as OrgRole,
    keyIsCanonicalId: orgKey === org.id,
  };
}

export async function getOrgMembershipBySlug(orgSlug: string) {
  return getOrgMembership(orgSlug);
}

export async function canAccessDataSource(params: {
  orgId: string;
  userId: string;
  role: OrgRole;
  dataSourceId: string;
}) {
  if (params.role === "owner" || params.role === "admin") return true;
  const supabase = await createClient();
  const { data } = await supabase
    .from("data_source_access")
    .select("id")
    .eq("org_id", params.orgId)
    .eq("user_id", params.userId)
    .eq("data_source_id", params.dataSourceId)
    .single();
  return !!data;
}

