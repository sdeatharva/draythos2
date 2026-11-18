/**
 * Unified Model Configuration
 * Central source of truth for all LLM providers and models across Draythos.
 */

export interface ModelDefinition {
  id: string;
  name: string;
  description: string;
  isPrimary?: boolean;
}

export const GEMINI_MODELS: readonly ModelDefinition[] = [
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    description: "Primary reasoning, high throughput, deep financial context",
    isPrimary: true,
  },
  {
    id: "gemini-3.7-flash",
    name: "Gemini 3.7 Flash",
    description: "General-purpose chat, analysis, and validation",
    isPrimary: false,
  },
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    description: "Summarization, document indexing, fallback engine",
    isPrimary: false,
  },
  {
    id: "gemini-3.5-flash",
    name: "Gemini 3.5 Flash",
    description: "Structured classification and rapid operations",
    isPrimary: false,
  },
  {
    id: "gemini-3.5-flash-lite",
    name: "Gemini 3.5 Flash-Lite",
    description: "Ultra-fast lightweight processing and classification",
    isPrimary: false,
  },
] as const;

export const OPENROUTER_MODELS: readonly ModelDefinition[] = [
  {
    id: "nvidia/nemotron-3.5-super-vl:free",
    name: "Nemotron 3.5 Super VL",
    description: "Multimodal document intelligence, table relationships",
    isPrimary: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    name: "Nemotron 3 Ultra",
    description: "Complex financial reasoning and multi-step reconciliation",
    isPrimary: false,
  },
  {
    id: "dots-studio/dots-3-note-preview:free",
    name: "Dots3-Note Preview",
    description: "Cross-document reasoning and long-context analysis",
    isPrimary: false,
  },
  {
    id: "xingchen-agi/xing4.0-29b-a4b:free",
    name: "Xing4.0 29B A4B",
    description: "Structured function calling and tool execution",
    isPrimary: false,
  },
  {
    id: "nvidia/nemotron-3.5-lightning:free",
    name: "Nemotron 3.5 Lightning",
    description: "Fast token stream and lightweight extraction",
    isPrimary: false,
  },
] as const;

export const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free";
export const FALLBACK_GEMINI_MODEL = "gemini-3.6-flash";

/**
 * Validates and resolves the appropriate model id strictly within the target provider's catalog.
 */
export function resolveProviderModel(
  provider: "gemini" | "openrouter",
  requestedModel?: string
): string {
  if (provider === "gemini") {
    const match = GEMINI_MODELS.find((m) => m.id === requestedModel);
    return match ? match.id : DEFAULT_GEMINI_MODEL;
  } else {
    const match = OPENROUTER_MODELS.find((m) => m.id === requestedModel);
    return match ? match.id : DEFAULT_OPENROUTER_MODEL;
  }
}
