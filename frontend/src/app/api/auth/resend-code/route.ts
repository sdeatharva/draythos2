import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const body = await req.json();
    const res = await fetch(`${VHAGAR_API_URL}/auth/resend-code`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Resend failed");
      try {
        const parsed = JSON.parse(errText);
        return NextResponse.json(parsed, { status: res.status });
      } catch {
        return NextResponse.json(
          { error: errText || `Resend failed (${res.status})` },
          { status: res.status }
        );
      }
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to resend code" },
      { status: 500 }
    );
  }
}

