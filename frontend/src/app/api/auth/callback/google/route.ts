import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const origin = req.nextUrl.origin || "http://localhost:3000";

  if (error || !code) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", error || "google_auth_canceled");
    return NextResponse.redirect(loginUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/callback/google`;

  if (!clientId || !clientSecret) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "google_oauth_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  try {
    // 1. Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("Google token exchange error:", errText);
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "token_exchange_failed");
      return NextResponse.redirect(loginUrl);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    // 2. Fetch verified Google user info
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userRes.ok) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "userinfo_fetch_failed");
      return NextResponse.redirect(loginUrl);
    }

    const googleUser = await userRes.json();
    const email = googleUser.email;
    const name = googleUser.name || email.split("@")[0];
    const googleId = googleUser.sub;

    // 3. Register or authenticate user in Draythos backend
    const backendRes = await fetch(`${VHAGAR_API_URL}/auth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, name, google_id: googleId }),
    });

    if (!backendRes.ok) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("error", "backend_auth_failed");
      return NextResponse.redirect(loginUrl);
    }

    const authData = await backendRes.json();

    // 4. Set persistent session cookies and redirect to /chat
    const chatUrl = new URL("/chat", req.url);
    const response = NextResponse.redirect(chatUrl);

    if (authData && authData.token) {
      const userCookie = {
        id: authData.id,
        email: authData.email,
        name: authData.name,
        role: authData.role,
        token: authData.token,
      };

      response.cookies.set("draythos_auth", JSON.stringify(userCookie), {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });

      response.cookies.set("draythos_token", authData.token, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });
    }

    return response;
  } catch (err: any) {
    console.error("Google OAuth callback exception:", err);
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("error", "oauth_internal_error");
    return NextResponse.redirect(loginUrl);
  }
}

