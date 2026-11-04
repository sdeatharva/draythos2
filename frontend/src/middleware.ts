import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("draythos_auth");

  let isAuthenticated = false;

  if (authCookie?.value && authCookie.value !== "undefined" && authCookie.value !== "null") {
    try {
      const parsed = JSON.parse(decodeURIComponent(authCookie.value));
      if (parsed && typeof parsed === "object" && parsed.id && (parsed.email || parsed.name)) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // 1. If user is already authenticated and visits /login or /register, redirect directly to /chat
  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/chat", request.url));
  }

  // 2. If user is NOT authenticated and attempts to enter /chat or /app/dashboard, redirect to /login
  if (!isAuthenticated && (pathname.startsWith("/chat") || pathname.startsWith("/app/dashboard"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register", "/chat/:path*", "/app/dashboard/:path*"],
};
