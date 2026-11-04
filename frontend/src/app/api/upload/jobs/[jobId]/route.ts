import { NextRequest, NextResponse } from "next/server";
import { VHAGAR_API_URL } from "@/lib/constants";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();
  try {
    const { jobId } = await params;
    const res = await fetch(`${VHAGAR_API_URL}/upload/jobs/${encodeURIComponent(jobId)}`, {
      headers: {
        "X-Correlation-ID": correlationId,
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Job not found (${res.status})` },
        { status: res.status, headers: { "X-Correlation-ID": correlationId } }
      );
    }

    const data = await res.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "X-Correlation-ID": correlationId },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to fetch job status" },
      { status: 500, headers: { "X-Correlation-ID": correlationId } }
    );
  }
}

