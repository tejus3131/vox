import { redirect } from "next/navigation";
import { BillingPage } from "@/components/settings/billing-page";
import { SettingsAccessDenied } from "@/components/settings/access-denied";
import { getOrgMembership } from "@/lib/org/membership";

export default async function BillingSettingsPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");
  if (!membership.keyIsCanonicalId) {
    redirect(`/${membership.org.id}/settings/billing`);
  }
  if (membership.role === "member") {
    return <SettingsAccessDenied orgSlug={membership.org.id} />;
  }

  return <BillingPage orgSlug={membership.org.id} orgId={membership.org.id} />;
}
