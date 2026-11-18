import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("draythos_auth");

  let isAuthenticated = false;

  if (authCookie?.value && authCookie.value !== "undefined" && authCookie.value !== "null") {
    try {
      const parsed = JSON.parse(decodeURIComponent(authCookie.value));
      if (parsed && typeof parsed === "object" && parsed.id) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // 1. If user is authenticated and visits /login or /register, redirect to /app/dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/app/dashboard", request.url));
  }

  // 2. Demo mode enabled: Allow full access to all /app/* routes and /chat without a login wall!
  // No forced redirection to /login, allowing demo dataroom exploration.

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register"],
};
