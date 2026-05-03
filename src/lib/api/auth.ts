import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAccessStateFromHeaders } from "@/lib/auth-access";

export async function requireUser() {
  const supabase = await createClient();
  const requestHeaders = await headers();
  const access = await getAccessStateFromHeaders(requestHeaders);

  if (!access) {
    return {
      supabase,
      user: null,
      unauthorized: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!access.emailVerified) {
    return {
      supabase,
      user: null,
      unauthorized: NextResponse.json(
        { error: "Email verification required", code: "email_not_verified" },
        { status: 403 }
      ),
    };
  }

  if (!access.mfaSatisfied) {
    return {
      supabase,
      user: null,
      unauthorized: NextResponse.json(
        { error: "MFA setup required", code: "mfa_required" },
        { status: 403 }
      ),
    };
  }

  return {
    supabase,
    user: {
      id: access.session.user.id,
      email: access.session.user.email,
      role: "member",
    },
    unauthorized: null,
  };
}
