import { clsx, type ClassValue } from "clsx";

/**
 * Merge class names. Uses clsx for conditional class merging.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Format bytes into human-readable size.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Format a date for display.
 */
export function formatDate(date?: Date | string | number | null): string {
  if (!date) return "Just now";
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return "Just now";
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  if (diffMins < 10080) return `${Math.floor(diffMins / 1440)}d ago`;

  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Truncate a string with ellipsis.
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "…";
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename?: string | null): string {
  if (!filename || typeof filename !== "string") return "";
  const clean = filename.trim();
  const lastDot = clean.lastIndexOf(".");
  return lastDot >= 0 ? clean.slice(lastDot + 1).toLowerCase() : "";
}

/**
 * Get the Lucide icon name for a file type.
 */
export function getFileIcon(filename: string): string {
  const ext = getFileExtension(filename);
  const icons: Record<string, string> = {
    pdf: "FileText",
    xlsx: "Sheet",
    xls: "Sheet",
    csv: "Table",
    docx: "FileText",
    txt: "FileText",
    json: "Braces",
    xml: "Code",
  };
  return icons[ext] || "File";
}

/**
 * Generate a short unique ID.
 */
export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

