"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Save,
  Download,
  Link2,
  Check,
  Loader2,
} from "lucide-react";
import type { DocumentReference } from "@/types";

/* ──────────────────────────── types ──────────────────────────── */

export interface DocumentToolbarProps {
  document: DocumentReference | { id: string; name: string } | null;
  format?: string | null;
  hasUnsavedChanges?: boolean;
  isSaving?: boolean;
  onSave?: () => void;
  onDownload?: ((type: "original" | "working") => void) | (() => void);
  onZoomChange?: (zoom: number) => void;
  zoom?: number; // 0.25 – 4.0 (1 = 100%)
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  viewSource?: "working" | "original";
  onViewSourceChange?: (mode: "working" | "original") => void;
}

/* ──────────────────────────── component ──────────────────────────── */

export function DocumentToolbar({
  document: doc,
  format,
  hasUnsavedChanges = false,
  isSaving = false,
  onSave,
  onDownload,
  onZoomChange = () => {},
  zoom = 1,
  page = 1,
  totalPages = 1,
  onPageChange = () => {},
  viewSource = "working",
  onViewSourceChange,
}: DocumentToolbarProps) {
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pageInput, setPageInput] = useState(String(page));
  const downloadRef = useRef<HTMLDivElement>(null);

  // Sync page input when prop changes
  useEffect(() => setPageInput(String(page)), [page]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        downloadRef.current &&
        !downloadRef.current.contains(e.target as Node)
      ) {
        setDownloadOpen(false);
      }
    };
    if (downloadOpen) window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [downloadOpen]);

  const docId = (doc as any)?.document_id || (doc as any)?.id || "";
  const effectiveFormat = format || (doc as any)?.format || "";
  const isPdf = effectiveFormat.toLowerCase() === "pdf";
  const zoomPercent = Math.round(zoom * 100);

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(pageInput, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      onPageChange(p);
    } else {
      setPageInput(String(page));
    }
  };

  const handleCopyLink = async () => {
    try {
      if (typeof window !== "undefined") {
        await navigator.clipboard.writeText(
          `${window.location.origin}/doc/${docId}`
        );
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* noop */
    }
  };

  const handleDownloadClick = (type: "original" | "working") => {
    if (onDownload) {
      if (onDownload.length > 0) {
        (onDownload as (t: "original" | "working") => void)(type);
      } else {
        (onDownload as () => void)();
      }
    }
    setDownloadOpen(false);
  };

  if (!doc) return null;

  /* ── save status text ── */
  const saveStatusText = isSaving
    ? "Saving…"
    : hasUnsavedChanges
      ? "Unsaved changes"
      : "Saved";

  return (
    <div className="flex items-center gap-1 border-b border-hairline bg-surface px-3 py-1.5 shrink-0">
      {/* ── Version toggle: Working Copy vs Original ── */}
      {onViewSourceChange && (
        <div className="flex items-center rounded-lg border border-hairline/80 bg-oat/50 p-0.5 mr-2">
          <button
            type="button"
            onClick={() => onViewSourceChange("working")}
            className={`px-2 py-0.5 rounded-md text-[11px] font-display font-medium transition-colors ${
              viewSource === "working"
                ? "bg-surface text-ink shadow-2xs font-semibold"
                : "text-cloud-dark hover:text-ink"
            }`}
            title="View latest versioned working copy with your prompt edits"
          >
            Working Copy
          </button>
          <button
            type="button"
            onClick={() => onViewSourceChange("original")}
            className={`px-2 py-0.5 rounded-md text-[11px] font-display font-medium transition-colors ${
              viewSource === "original"
                ? "bg-surface text-ink shadow-2xs font-semibold"
                : "text-cloud-dark hover:text-ink"
            }`}
            title="View immutable original source document"
          >
            Original
          </button>
        </div>
      )}

      {/* ── View controls (PDF) ── */}
      {isPdf && (
        <div className="flex items-center gap-1">
          {/* Zoom out */}
          <button
            onClick={() => onZoomChange(Math.max(0.25, zoom - 0.25))}
            disabled={zoom <= 0.25}
            className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Zoom out"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>

          {/* Zoom label */}
          <span className="min-w-[3rem] text-center font-mono text-xs text-text-muted">
            {zoomPercent}%
          </span>

          {/* Zoom in */}
          <button
            onClick={() => onZoomChange(Math.min(4, zoom + 0.25))}
            disabled={zoom >= 4}
            className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Zoom in"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>

          {/* Fit width */}
          <button
            onClick={() => onZoomChange(1)}
            className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Fit width"
            title="Fit width"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Separator */}
          <div className="mx-1 h-5 w-px bg-hairline" />

          {/* Page navigation */}
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <form onSubmit={handlePageSubmit} className="flex items-center gap-1">
            <input
              type="text"
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageSubmit}
              className="w-8 rounded-[var(--radius-control)] border border-hairline bg-canvas px-1 py-0.5 text-center font-mono text-xs text-ink focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
              aria-label="Current page"
            />
            <span className="font-mono text-xs text-text-muted">
              / {totalPages}
            </span>
          </form>

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mx-1 h-5 w-px bg-hairline" />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* ── Save status ── */}
      <span
        className={`mr-2 font-mono text-xs ${
          hasUnsavedChanges ? "text-clay-deep" : "text-text-muted"
        }`}
      >
        {saveStatusText}
      </span>

      {/* ── Save button ── */}
      <button
        onClick={onSave}
        disabled={!hasUnsavedChanges || isSaving}
        className={`
          inline-flex items-center gap-1.5 rounded-[var(--radius-control)] px-3 py-1.5 font-display text-xs font-medium transition-colors
          focus:outline-2 focus:outline-ink focus:outline-offset-[3px]
          ${
            hasUnsavedChanges
              ? "bg-clay text-ink hover:bg-clay-deep hover:text-surface"
              : "bg-surface text-text-muted border border-hairline"
          }
          disabled:opacity-50
        `}
      >
        {isSaving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Save className="h-3.5 w-3.5" />
        )}
        <span className="hidden sm:inline">Save</span>
      </button>

      {/* ── Download dropdown ── */}
      <div className="relative" ref={downloadRef}>
        <button
          onClick={() => setDownloadOpen((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 py-1.5 font-display text-xs font-medium text-ink transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download</span>
        </button>

        {downloadOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-[var(--radius-control)] border border-hairline bg-surface py-1 shadow-lg">
            <button
              onClick={() => handleDownloadClick("original")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-reading text-xs text-ink hover:bg-oat"
            >
              <Download className="h-3.5 w-3.5 text-text-muted" />
              Download original
            </button>
            <button
              onClick={() => handleDownloadClick("working")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left font-reading text-xs text-ink hover:bg-oat"
            >
              <Download className="h-3.5 w-3.5 text-text-muted" />
              Download working copy
            </button>
          </div>
        )}
      </div>

      {/* ── Copy link ── */}
      <button
        onClick={handleCopyLink}
        className="rounded-[var(--radius-control)] p-1.5 text-ink-soft transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
        aria-label="Copy link"
        title="Copy link"
      >
        {copied ? (
          <Check className="h-4 w-4 text-clay" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}

export default DocumentToolbar;
