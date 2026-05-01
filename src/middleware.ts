import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { LEGACY_AUTH_CALLBACK_PATH, OAUTH_PKCE_CALLBACK_PATH } from "@/lib/roleRouting";

function requirePkceCodeOrLoginRedirect(request: NextRequest): NextResponse | null {
  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  if (!code) {
    const dest = request.nextUrl.clone();
    dest.pathname = "/loginpage";
    dest.search = "";
    return NextResponse.redirect(dest);
  }
  return null;
}

/**
 * OAuth PKCE only. Canonical path: {@link OAUTH_PKCE_CALLBACK_PATH}.
 *
 * If the browser still hits {@link LEGACY_AUTH_CALLBACK_PATH} (old Supabase Redirect URL),
 * we 307 to the canonical path with the same query — that is IdP-driven, not app post-login.
 * Remove `/auth/callback` from Supabase Auth redirect allowlist to drop this hop entirely.
 */
export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === LEGACY_AUTH_CALLBACK_PATH) {
    const denied = requirePkceCodeOrLoginRedirect(request);
    if (denied) return denied;
    const dest = request.nextUrl.clone();
    dest.pathname = OAUTH_PKCE_CALLBACK_PATH;
    return NextResponse.redirect(dest);
  }

  if (pathname === OAUTH_PKCE_CALLBACK_PATH) {
    const denied = requirePkceCodeOrLoginRedirect(request);
    if (denied) return denied;
  }

  if (pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/auth/callback", "/auth/oauth/callback"],
};
