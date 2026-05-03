import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DatabaseAccessPage } from "@/components/settings/database-access-page";
import { SettingsAccessDenied } from "@/components/settings/access-denied";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getOrgMembership } from "@/lib/org/membership";

export default async function DatabasesSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/settings/databases`);
  }
  if (membership.role === "member") {
    return <SettingsAccessDenied orgSlug={membership.org.id} />;
  }

  const supabase = await createClient();
  const { data: dataSources } = await supabase
    .from("data_sources")
    .select("id, name, status")
    .eq("org_id", membership.org.id)
    .order("name");

  const fullOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: membership.org.id },
  });

  const { data: grants } = await supabase
    .from("data_source_access")
    .select("*")
    .eq("org_id", membership.org.id);

  return (
    <DatabaseAccessPage
      orgSlug={membership.org.id}
      orgId={membership.org.id}
      dataSources={dataSources ?? []}
      members={fullOrg?.members ?? []}
      grants={grants ?? []}
    />
  );
}
