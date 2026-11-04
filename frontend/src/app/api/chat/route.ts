import { NextRequest, NextResponse } from "next/server";
import {
  validateChatRequest,
  buildRetrievalContext,
  executeChatCompletion,
} from "@/lib/chat-service";
import { generateId } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const correlationId = req.headers.get("X-Correlation-ID") || generateId();

  try {
    const rawBody = await req.json();
    const chatRequest = validateChatRequest(rawBody);

    const context = await buildRetrievalContext(chatRequest, correlationId);
    const result = await executeChatCompletion(chatRequest, context);

    return NextResponse.json(
      {
        message: result.text,
        citations: result.citations,
        provider: result.provider,
        finishReason: result.finishReason,
        usage: result.usage,
      },
      {
        headers: {
          "X-Correlation-ID": correlationId,
        },
      }
    );
  } catch (error: any) {
    console.error(`[${correlationId}] Chat route error:`, error);
    return NextResponse.json(
      {
        error: error.message || "Failed to process chat request",
        correlationId,
      },
      {
        status: 400,
        headers: { "X-Correlation-ID": correlationId },
      }
    );
  }
}

