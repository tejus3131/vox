import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function POST(request: Request) {
  try {
    const { email, callbackURL } = await request.json();
    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 });
    }

    const fromEnv = process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "";
    const requestOrigin = new URL(request.url).origin;
    const base = fromEnv || requestOrigin;
    const response = await fetch(`${base}/api/auth/send-verification-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, callbackURL }),
    });

    if (!response.ok) {
      const text = await response.text();
      Sentry.captureMessage("verification_email_resend_failed", {
        level: "warning",
        extra: {
          status: response.status,
          reason: text.slice(0, 300),
        },
      });
      return NextResponse.json({ message: "Could not resend verification email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    Sentry.captureException(error);
    return NextResponse.json({ message: "Could not resend verification email" }, { status: 500 });
  }
}

