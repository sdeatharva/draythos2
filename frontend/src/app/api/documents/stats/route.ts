import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const backendRes = await fetch(`${VHAGAR_API_URL}/stats`, {
      headers: { "X-Correlation-ID": correlationId },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const err = await backendRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Stats fetch failed (${backendRes.status}): ${err}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Stats proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch stats", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

