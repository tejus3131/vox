import { redirect } from "next/navigation";
import { getAccessState } from "@/lib/auth-access";
import { AccountSettingsPage } from "@/components/settings/account-settings-page";

export default async function AccountPage() {
  const access = await getAccessState();
  if (!access) redirect("/login");
  if (!access.emailVerified) {
    redirect(`/verify-email?email=${encodeURIComponent(access.session.user.email)}`);
  }
  if (!access.mfaSatisfied) {
    redirect("/mfa-setup");
  }

  return <AccountSettingsPage />;
}

