import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ documentId: string }> }
) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();
  const { documentId } = await context.params;

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required", correlationId },
      { status: 400, headers: { "X-Correlation-ID": correlationId } }
    );
  }

  try {
    const body = await req.json();

    const backendRes = await fetch(
      `${VHAGAR_API_URL}/documents/${encodeURIComponent(documentId)}/save`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Correlation-ID": correlationId,
        },
        body: JSON.stringify(body),
      }
    );

    if (!backendRes.ok) {
      const err = await backendRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Save failed (${backendRes.status}): ${err}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Save proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to save document edits", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

