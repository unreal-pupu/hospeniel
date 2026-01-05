import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Protect admin routes at middleware level
  if (request.nextUrl.pathname.startsWith("/admin")) {
    // Admin routes are protected by the layout component
    // Middleware can add additional checks if needed
    // For now, we'll let the layout handle the authentication
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};





