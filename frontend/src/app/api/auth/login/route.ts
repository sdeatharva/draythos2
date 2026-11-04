import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Auth failed");
      try {
        const parsed = JSON.parse(errText);
        return NextResponse.json(parsed, { status: res.status });
      } catch {
        return NextResponse.json(
          { error: errText || `Auth failed (${res.status})` },
          { status: res.status }
        );
      }
    }

    const data = await res.json();
    const response = NextResponse.json(data);

    if (data && data.token) {
      const userCookie = {
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
        token: data.token,
      };
      response.cookies.set("draythos_auth", JSON.stringify(userCookie), {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });
      response.cookies.set("draythos_token", data.token, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
      });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to authenticate" },
      { status: 500 }
    );
  }
}

