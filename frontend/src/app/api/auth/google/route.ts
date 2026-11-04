import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;

  if (!clientId) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "google_oauth_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const origin = req.nextUrl.origin || "http://localhost:3000";
  const redirectUri = `${origin}/api/auth/callback/google`;

  const state = Math.random().toString(36).substring(2);
  const scope = encodeURIComponent("openid email profile");

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
    clientId
  )}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&response_type=code&scope=${scope}&state=${state}&access_type=offline&prompt=select_account`;

  const response = NextResponse.redirect(googleAuthUrl);
  response.cookies.set("draythos_oauth_state", state, {
    path: "/",
    maxAge: 600,
    httpOnly: true,
    sameSite: "lax",
  });

  return response;
}

