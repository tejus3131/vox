import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { MembersPage } from "@/components/settings/members-page";
import { SettingsAccessDenied } from "@/components/settings/access-denied";
import { getOrgMembership } from "@/lib/org/membership";

export default async function MembersSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/settings/members`);
  }
  if (membership.role === "member") {
    return <SettingsAccessDenied orgSlug={membership.org.id} />;
  }

  const fullOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: membership.org.id },
  });

  return (
    <MembersPage
      orgSlug={membership.org.id}
      orgId={membership.org.id}
      members={fullOrg?.members ?? []}
      invitations={fullOrg?.invitations ?? []}
    />
  );
}
