import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("draythos_auth");
  response.cookies.delete("draythos_token");
  response.cookies.set("draythos_auth", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set("draythos_token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}

export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.url);
  const response = NextResponse.redirect(loginUrl);
  response.cookies.delete("draythos_auth");
  response.cookies.delete("draythos_token");
  response.cookies.set("draythos_auth", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set("draythos_token", "", {
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
