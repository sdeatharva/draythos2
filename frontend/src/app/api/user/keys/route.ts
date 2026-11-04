import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("user_id") || "usr_default";

    const res = await fetch(`${VHAGAR_API_URL}/user/keys?user_id=${encodeURIComponent(userId)}`, {
      headers: {
        "X-Correlation-ID": generateId(),
      },
    });

    if (!res.ok) {
      return NextResponse.json({ openrouter_key: "", gemini_key: "" }, { status: 200 });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ openrouter_key: "", gemini_key: "", error: err.message }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/user/keys`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": generateId(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to save API keys" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

