import { redirect } from "next/navigation";
import { getOrgMembership } from "@/lib/org/membership";

export default async function LegacyOrgSlugRedirectPage({
  params,
}: {
  params: Promise<{ orgSlug: string; rest?: string[] }>;
}) {
  const { orgSlug, rest } = await params;
  const membership = await getOrgMembership(orgSlug);
  if (!membership) {
    redirect("/");
  }
  const tail = rest && rest.length > 0 ? `/${rest.join("/")}` : "";
  redirect(`/${membership.org.id}${tail}`);
}

