import { createAuthClient } from "better-auth/react";
import { organizationClient, adminClient, twoFactorClient } from "better-auth/client/plugins";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "",
  plugins: [
    organizationClient(),
    adminClient(),
    twoFactorClient({
      onTwoFactorRedirect({ twoFactorMethods }) {
        void twoFactorMethods;
        window.location.href = "/two-factor";
      },
    }),
    passkeyClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization,
  twoFactor,
  passkey,
  admin,
} = authClient;
