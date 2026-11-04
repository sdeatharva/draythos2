/** Backend API URL */
export const VHAGAR_API_URL =
  process.env.VHAGAR_API_URL ?? "http://127.0.0.1:8001";

/** Supported file format definitions */
export const SUPPORTED_FORMATS = [
  { ext: "pdf", mime: "application/pdf", label: "PDF" },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", label: "Excel" },
  { ext: "xls", mime: "application/vnd.ms-excel", label: "Excel (Legacy)" },
  { ext: "csv", mime: "text/csv", label: "CSV" },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", label: "Word" },
  { ext: "txt", mime: "text/plain", label: "Text" },
  { ext: "json", mime: "application/json", label: "JSON" },
  { ext: "xml", mime: "application/xml", label: "XML" },
] as const;

/** Accepted file extensions for upload input */
export const ACCEPTED_EXTENSIONS = SUPPORTED_FORMATS.map((f) => `.${f.ext}`).join(",");

/** Maximum upload size in megabytes */
export const MAX_UPLOAD_SIZE_MB = 50;

/** Retry delay for streaming reconnection */
export const STREAMING_RETRY_DELAY = 1000;

/** Free-tier model definitions (strictly free, no charges) */
export const FREE_GEMINI_MODELS = [
  { id: "gemini-3.8-flash", name: "Gemini 3.8 Flash", description: "Main AI: complex reasoning, document Q&A, cross-document analysis", isPrimary: true },
  { id: "gemini-3.7-flash", name: "Gemini 3.7 Flash", description: "General-purpose chat and reasoning", isPrimary: false },
  { id: "gemini-3.6-flash", name: "Gemini 3.6 Flash", description: "Document analysis, summarization, chat", isPrimary: false },
  { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", description: "General tasks and structured responses", isPrimary: false },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite", description: "Bulk extraction, classification, simple operations", isPrimary: false },
] as const;

export const FREE_OPENROUTER_MODELS = [
  { id: "nvidia/nemotron-3.5-super-vl:free", name: "Nemotron 3.5 Super VL", description: "Primary document intelligence, multimodal understanding, complex reasoning", isPrimary: true },
  { id: "nvidia/nemotron-3-ultra-550b-a55b:free", name: "Nemotron 3 Ultra", description: "Complex reasoning, planning, agent orchestration", isPrimary: false },
  { id: "dots-studio/dots-3-note-preview:free", name: "Dots3-Note Preview", description: "Long-context document analysis, cross-document reasoning", isPrimary: false },
  { id: "xingchen-agi/xing4.0-29b-a4b:free", name: "Xing4.0 29B A4B", description: "Tool calling, structured outputs, multi-step operations", isPrimary: false },
  { id: "nvidia/nemotron-3.5-lightning:free", name: "Nemotron 3.5 Lightning", description: "Fast extraction, classification, lightweight processing", isPrimary: false },
] as const;

/** Default primary model (Google Gemini free tier) */
export const DEFAULT_MODEL = "gemini-3.8-flash";

/** Default OpenRouter free model */
export const DEFAULT_OPENROUTER_MODEL = "nvidia/nemotron-3.5-super-vl:free";

/** Fallback model */
export const FALLBACK_MODEL = "gemini-3.6-flash";

/** Breakpoints matching the design system */
export const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

/** Curated 25 high-vocabulary greeting words (replacing generic greetings and copycat starbursts) */
export const HIGH_VOCAB_GREETINGS = [
  "Salutations",
  "Felicitations",
  "Greetings",
  "Accolades",
  "Valedictions",
  "Benedictions",
  "Deference",
  "Homage",
  "Reverence",
  "Obeisance",
  "Cordialities",
  "Auspices",
  "Compliments",
  "Welcomes",
  "Salut",
  "Ave",
  "Salve",
  "Prosit",
  "Hosannas",
  "Rejoice",
  "Pax",
  "Namaste",
  "Pranam",
  "Godspeed",
  "Veneration",
] as const;

