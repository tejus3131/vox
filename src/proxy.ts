import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set(["/", "/login", "/signup", "/two-factor", "/verify-email", "/mfa-setup"]);
const PUBLIC_PREFIXES = ["/api/auth/", "/invite/"];

function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/.test(pathname)
  );
}

function hasBetterAuthSessionCookie(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some(
      (cookie) =>
        cookie.name === "better-auth.session_token" ||
        cookie.name === "__Secure-better-auth.session_token" ||
        cookie.name.startsWith("better-auth.session_token.") ||
        cookie.name.startsWith("__Secure-better-auth.session_token.")
    );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  if (!hasBetterAuthSessionCookie(request)) {
    if (isApiRoute(pathname)) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          code: "session_required",
          login: `/login?callbackUrl=${encodeURIComponent(pathname)}`,
        },
        { status: 401 }
      );
    }
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
