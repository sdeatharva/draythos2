import { NextRequest, NextResponse } from "next/server";
import {
  validateChatRequest,
  buildRetrievalContext,
  createChatStream,
} from "@/lib/chat-service";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const rawBody = await req.json();
    const chatRequest = validateChatRequest(rawBody);

    const context = await buildRetrievalContext(chatRequest, correlationId);
    const stream = await createChatStream(chatRequest, context);

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Correlation-ID": correlationId,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error: any) {
    console.error(`[${correlationId}] Stream route error:`, error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process chat stream",
        correlationId,
      },
      {
        status: 400,
        headers: { "X-Correlation-ID": correlationId },
      }
    );
  }
}

