import { redirect } from "next/navigation";
import { OrgSettingsPage } from "@/components/settings/org-settings";
import { SettingsAccessDenied } from "@/components/settings/access-denied";
import { getOrgMembership } from "@/lib/org/membership";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/settings`);
  }
  if (membership.role === "member") {
    return <SettingsAccessDenied orgSlug={membership.org.id} />;
  }

  return (
    <OrgSettingsPage
      orgSlug={membership.org.id}
      orgId={membership.org.id}
      orgName={membership.org.name}
      role={membership.role}
    />
  );
}
