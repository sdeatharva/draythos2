import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const res = await fetch(`${VHAGAR_API_URL}/auth/verify`, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}

