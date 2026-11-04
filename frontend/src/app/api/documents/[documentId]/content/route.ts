import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
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
    const { searchParams } = new URL(req.url);
    const version = searchParams.get("version");
    const targetUrl = version
      ? `${VHAGAR_API_URL}/documents/${encodeURIComponent(documentId)}/content?version=${encodeURIComponent(version)}`
      : `${VHAGAR_API_URL}/documents/${encodeURIComponent(documentId)}/content`;

    const backendRes = await fetch(
      targetUrl,
      {
        headers: { "X-Correlation-ID": correlationId },
        cache: "no-store",
      }
    );

    if (!backendRes.ok) {
      const err = await backendRes.text().catch(() => "");
      return NextResponse.json(
        { error: `Content not found (${backendRes.status}): ${err}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await backendRes.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] Content proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch document content", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

