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
  const response = await fetch(`${VHAGAR_API_URL}/documents/${encodeURIComponent(documentId)}/revert`, {
    method: "POST",
    headers: { "X-Correlation-ID": correlationId },
  });
  if (!response.ok) {
    return NextResponse.json(
      { error: await response.text(), correlationId },
      { status: response.status, headers: { "X-Correlation-ID": correlationId } }
    );
  }
  return NextResponse.json(await response.json(), { headers: { "X-Correlation-ID": correlationId } });
}
