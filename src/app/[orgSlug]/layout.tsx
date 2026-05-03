import { redirect } from "next/navigation";
import { getAccessState } from "@/lib/auth-access";
import { getOrgMembership } from "@/lib/org/membership";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug: orgKey } = await params;

  const accessState = await getAccessState();
  if (!accessState) redirect("/login");
  if (!accessState.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(accessState.session.user.email)}`);
  }
  if (!accessState.mfaSatisfied) {
    redirect("/mfa-setup");
  }

  const membership = await getOrgMembership(orgKey);
  if (!membership) redirect("/");

  return <>{children}</>;
}
