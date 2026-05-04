import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { admin } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { Pool } from "pg";
import { sendVerificationEmail } from "@/lib/email/auth-mailer";
import { sendOrgInviteEmail } from "@/lib/email/resend";

/**
 * Better Auth resolves baseURL at init (no Request yet). If it stays empty, ctx.baseURL becomes ""
 * and the built-in rate limiter does `new URL("")` → ERR_INVALID_URL (production enables rate limiting).
 * Read from process.env explicitly so Bun/Next always see .env values.
 */
function resolveBetterAuthBaseURL(): string {
  const trimmed =
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL?.trim() ||
    (process.env.VERCEL_URL?.trim() ? `https://${process.env.VERCEL_URL.trim()}` : "");

  if (!trimmed) {
    throw new Error(
      "Missing BETTER_AUTH_URL or NEXT_PUBLIC_BETTER_AUTH_URL. Set e.g. BETTER_AUTH_URL=http://localhost:3000 in .env (required for Better Auth; empty baseURL breaks auth routes when rate limiting runs)."
    );
  }
  return trimmed.replace(/\/+$/, "");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const resolvedBaseURL = resolveBetterAuthBaseURL();
const baseUrlHost = (() => {
  try {
    return new URL(resolvedBaseURL).hostname;
  } catch {
    return "";
  }
})();
const isLocalDevHost = baseUrlHost === "localhost" || baseUrlHost === "127.0.0.1";

export const auth = betterAuth({
  database: pool,
  appName: "Vox",
  baseURL: resolvedBaseURL,
  secret: process.env.BETTER_AUTH_SECRET,

  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      try {
        await sendVerificationEmail({
          to: user.email,
          url,
          name: user.name,
        });
      } catch (error) {
        console.error("[Auth] verification email send failed", {
          email: user.email,
          reason: error instanceof Error ? error.message : "unknown_error",
        });
        throw error;
      }
    },
  },

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  advanced: {
    // Running `next start` locally uses production mode; force non-secure cookies on localhost.
    useSecureCookies: !isLocalDevHost,
  },

  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      sendInvitationEmail: async (ctx) => {
        await sendOrgInviteEmail({
          to: ctx.email,
          orgName: ctx.organization.name,
          role: ctx.role,
          invitationId: ctx.id,
        });
      },
    }),
    admin(),
    twoFactor({
      issuer: "Vox",
    }),
    passkey(),
  ],
});

export type Session = typeof auth.$Infer.Session.session;
export type User = typeof auth.$Infer.Session.user;
