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
  const isDownload = req.nextUrl.searchParams.get("download") === "true";
  const isOriginal = req.nextUrl.searchParams.get("original") === "true";
  const version = req.nextUrl.searchParams.get("version") || "";

  if (!documentId) {
    return NextResponse.json(
      { error: "documentId is required", correlationId },
      { status: 400, headers: { "X-Correlation-ID": correlationId } }
    );
  }

  try {
    const backendUrl = `${VHAGAR_API_URL}/documents/${encodeURIComponent(documentId)}/file?download=${isDownload}&original=${isOriginal}&version=${encodeURIComponent(version)}`;
    const backendRes = await fetch(backendUrl, {
      headers: { "X-Correlation-ID": correlationId },
      cache: "no-store",
    });

    if (!backendRes.ok) {
      const err = await backendRes.text().catch(() => "");
      return NextResponse.json(
        { error: `File not found (${backendRes.status}): ${err}`, correlationId },
        { status: backendRes.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const contentType =
      backendRes.headers.get("content-type") || "application/octet-stream";
    const contentDisposition =
      backendRes.headers.get("content-disposition") ||
      (isDownload ? `attachment; filename="${documentId}"` : "inline");

    return new Response(backendRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Correlation-ID": correlationId,
      },
    });
  } catch (err: any) {
    console.error(`[${correlationId}] File proxy error:`, err);
    return NextResponse.json(
      { error: err.message || "Failed to serve document file", correlationId },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

