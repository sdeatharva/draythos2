import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const res = await fetch(`${VHAGAR_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      headers: {
        "X-Correlation-ID": generateId(),
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Session not found" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load session" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": generateId(),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to update session" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const res = await fetch(`${VHAGAR_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
      headers: {
        "X-Correlation-ID": generateId(),
      },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to delete session" }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

