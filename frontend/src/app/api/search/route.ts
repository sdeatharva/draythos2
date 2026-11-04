import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const body = await req.json();
    const query = typeof body.query === "string" ? body.query.trim() : "";

    if (!query) {
      return NextResponse.json(
        { error: "Query is required", correlationId },
        { status: 400, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const backendRes = await fetch(`${VHAGAR_API_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
      },
      body: JSON.stringify({
        query,
        session_id: body.sessionId || body.session_id,
        document_ids: body.documentIds || body.document_ids,
        top_k: body.topK || body.top_k || 10,
        include_global: Boolean(body.includeGlobal ?? body.include_global),
      }),
    });

    if (!backendRes.ok) {
      const err = await backendRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Search failed (${backendRes.status}): ${err}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Search proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Search request failed", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

