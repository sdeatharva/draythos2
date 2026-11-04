import type { StreamEvent } from "@/types";

interface ProviderConfig {
  name: string;
  model: string;
  baseUrl: string;
  supportsImages: boolean;
  supportsPdf: boolean;
}

export function getProviderConfig(
  name: "openrouter" | "gemini"
): ProviderConfig {
  if (name === "openrouter") {
    return {
      name: "openrouter",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-5.4",
      baseUrl: "https://openrouter.ai/api/v1",
      supportsImages: true,
      supportsPdf: true,
    };
  }
  return {
    name: "gemini",
    model: process.env.GEMINI_MODEL ?? "gemini-3-pro-preview",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    supportsImages: true,
    supportsPdf: true,
  };
}

export function buildOpenRouterRequest(
  messages: { role: string; content: string }[],
  model: string,
  stream: boolean
): { url: string; options: RequestInit } {
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
        "HTTP-Referer": "https://draythos.app",
        "X-Title": "Draythos",
      },
      body: JSON.stringify({ model, messages, stream }),
    },
  };
}

export function buildGeminiRequest(
  messages: { role: string; content: string }[],
  model: string,
  stream: boolean
): { url: string; options: RequestInit } {
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const endpoint = stream ? "streamGenerateContent" : "generateContent";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${endpoint}?key=${apiKey}${stream ? "&alt=sse" : ""}`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return {
    url,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    },
  };
}

export async function* parseOpenRouterStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") {
        yield { type: "complete", data: "", finish_reason: "stop" };
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content ?? "";
        const finish = parsed.choices?.[0]?.finish_reason;
        if (delta) {
          yield { type: "delta", data: delta };
        }
        if (finish) {
          yield { type: "complete", data: "", finish_reason: finish };
        }
      } catch {
        // Skip malformed lines
      }
    }
  }
}

export async function* parseGeminiStream(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<StreamEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const text =
          parsed.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) {
          yield { type: "delta", data: text };
        }
        if (parsed.candidates?.[0]?.finishReason) {
          yield {
            type: "complete",
            data: "",
            finish_reason: parsed.candidates[0].finishReason,
          };
        }
      } catch {
        // Skip malformed
      }
    }
  }
}

export function isRecoverableError(status: number, error: string): boolean {
  // Recoverable: server errors, rate limits, timeouts
  if (status >= 500 || status === 429 || status === 408) return true;
  // Not recoverable: auth, safety, bad request
  if (status === 401 || status === 403 || status === 400) return false;
  // Check error content
  const lower = error.toLowerCase();
  if (
    lower.includes("safety") ||
    lower.includes("blocked") ||
    lower.includes("invalid")
  )
    return false;
  return true;
}

