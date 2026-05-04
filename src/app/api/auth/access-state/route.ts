import { NextResponse } from "next/server";
import { getAccessStateFromHeaders } from "@/lib/auth-access";

export async function GET(request: Request) {
  const access = await getAccessStateFromHeaders(request.headers);
  if (!access) {
    return NextResponse.json({
      isAuthenticated: false,
      emailVerified: false,
      mfaSatisfied: false,
    });
  }

  return NextResponse.json({
    isAuthenticated: true,
    emailVerified: access.emailVerified,
    mfaSatisfied: access.mfaSatisfied,
  });
}

