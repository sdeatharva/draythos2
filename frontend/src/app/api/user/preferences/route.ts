import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();
  const userId = req.nextUrl.searchParams.get("user_id") || "usr_default";

  try {
    const res = await fetch(`${VHAGAR_API_URL}/user/preferences?user_id=${encodeURIComponent(userId)}`, {
      headers: { "X-Correlation-ID": correlationId },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ custom_instructions: "", memories: [] });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/user/preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to update preferences" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

