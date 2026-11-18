import {
  GEMINI_MODELS,
  OPENROUTER_MODELS,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  FALLBACK_GEMINI_MODEL,
  resolveProviderModel,
} from "./model-config";

export interface ProviderConfig {
  name: "openrouter" | "gemini";
  model: string;
  baseUrl: string;
}

export function getProvider(
  name: "openrouter" | "gemini",
  requestedModel?: string
): ProviderConfig {
  if (name === "openrouter") {
    return {
      name: "openrouter",
      model: resolveProviderModel("openrouter", requestedModel),
      baseUrl: "https://openrouter.ai/api/v1",
    };
  }

  return {
    name: "gemini",
    model: resolveProviderModel("gemini", requestedModel),
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  };
}

export function buildOpenRouterRequest(
  messages: Array<{ role: string; content: string }>,
  model: string,
  stream = true
) {
  const resolved = resolveProviderModel("openrouter", model);
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    init: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY ?? ""}`,
      },
      body: JSON.stringify({ model: resolved, messages, stream }),
    },
  };
}

export function buildGeminiRequest(
  messages: Array<{ role: string; content: string }>,
  model: string,
  stream = true
) {
  const resolved = resolveProviderModel("gemini", model);
  const apiKey = process.env.GEMINI_API_KEY ?? "";
  const endpoint = stream ? "streamGenerateContent" : "generateContent";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolved}:${endpoint}?key=${apiKey}${
    stream ? "&alt=sse" : ""
  }`;

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  return {
    url,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents }),
    },
  };
}

export async function* parseOpenRouterStream(
  response: Response
): AsyncGenerator<string, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);
      if (data === "[DONE]") return;

      try {
        const parsed = JSON.parse(data);
        const text = parsed.choices?.[0]?.delta?.content;
        if (text) yield text;
      } catch {
        // Skip invalid JSON lines
      }
    }
  }
}

export async function* parseGeminiStream(
  response: Response
): AsyncGenerator<string, void, unknown> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data: ")) continue;
      const data = trimmed.slice(6);

      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) yield text;
      } catch {
        // Skip invalid JSON lines
      }
    }
  }
}
