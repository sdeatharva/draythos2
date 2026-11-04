import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/user/memories`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to add memory" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();
  const memoryId = req.nextUrl.searchParams.get("id");
  const userId = req.nextUrl.searchParams.get("user_id") || "usr_default";

  if (!memoryId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const res = await fetch(`${VHAGAR_API_URL}/user/memories/${encodeURIComponent(memoryId)}?user_id=${encodeURIComponent(userId)}`, {
      method: "DELETE",
      headers: { "X-Correlation-ID": correlationId },
    });

    return NextResponse.json(await res.json());
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

