import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type AccessState = {
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  emailVerified: boolean;
  hasTotp: boolean;
  hasPasskey: boolean;
  mfaSatisfied: boolean;
};

export async function getAccessState(): Promise<AccessState | null> {
  return getAccessStateFromHeaders(await headers());
}

export async function getAccessStateFromHeaders(
  requestHeaders: Headers
): Promise<AccessState | null> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;

  const emailVerified = !!session.user.emailVerified;
  const hasTotp = !!(session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled;
  let hasPasskey = false;
  try {
    const passkeys = await auth.api.listPasskeys({
      headers: requestHeaders,
    });
    hasPasskey = (passkeys?.length ?? 0) > 0;
  } catch {
    hasPasskey = false;
  }
  const mfaSatisfied = hasTotp || hasPasskey;

  return {
    session: session as NonNullable<typeof session>,
    emailVerified,
    hasTotp,
    hasPasskey,
    mfaSatisfied,
  };
}

