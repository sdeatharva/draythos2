import { VHAGAR_API_URL } from "./constants";
import { generateId } from "./utils";

/**
 * Fetch wrapper for Vhagar backend with correlation IDs and error handling.
 */
export async function vhagarFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = `${VHAGAR_API_URL}${path}`;
  const headers = new Headers(options.headers);

  headers.set("X-Correlation-ID", generateId());

  const response = await fetch(url, { ...options, headers });
  return response;
}

/**
 * Handle API errors and throw structured error.
 */
export async function handleApiError(response: Response): Promise<never> {
  let detail = "Unknown error";
  try {
    const body = await response.json();
    detail = body.detail || body.message || body.error || JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => `HTTP ${response.status}`);
  }
  throw new Error(`API Error (${response.status}): ${detail}`);
}

/**
 * Build multipart FormData from a file and optional fields.
 */
export function createFormData(
  file: File,
  fields: Record<string, string> = {}
): FormData {
  const fd = new FormData();
  fd.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    fd.append(key, value);
  }
  return fd;
}

/**
 * Add a correlation ID header.
 */
export function withCorrelationId(headers: HeadersInit = {}): Headers {
  const h = new Headers(headers);
  if (!h.has("X-Correlation-ID")) {
    h.set("X-Correlation-ID", generateId());
  }
  return h;
}

/**
 * Wrap a promise with a timeout.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message = "Request timed out"
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(message)), ms)
    ),
  ]);
}

