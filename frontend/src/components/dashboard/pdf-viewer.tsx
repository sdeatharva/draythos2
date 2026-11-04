"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  AlertTriangle,
  Loader2,
  FileText,
  Layers,
  Edit3,
  Save,
  CheckCircle2,
  Plus,
} from "lucide-react";

/* ──────────────────────────── types ──────────────────────────── */

export interface PdfViewerProps {
  fileUrl: string;
  totalPages: number;
  onPageChange: (page: number) => void;
  currentPage: number;
  zoom: number; // 0.25–4 (1 = 100%)
  searchQuery?: string;
  isOcrInProgress?: boolean;
  extractedText?: string;
  pagesData?: { page_number: number; text: string; confidence?: number; ocr_applied?: boolean }[];
  onSaveEdits?: (content: string) => void;
}

/* ──────────────────────────── page skeleton ──────────────────────────── */

function PageSkeleton({ width, height }: { width: number; height: number }) {
  return (
    <div
      className="mx-auto animate-pulse rounded-control bg-oat"
      style={{ width, height }}
    >
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8">
        <div className="h-3 w-3/4 rounded bg-cloud" />
        <div className="h-3 w-full rounded bg-cloud" />
        <div className="h-3 w-5/6 rounded bg-cloud" />
        <div className="h-3 w-2/3 rounded bg-cloud" />
        <div className="h-3 w-full rounded bg-cloud" />
        <div className="h-3 w-4/5 rounded bg-cloud" />
      </div>
    </div>
  );
}

/* ──────────────────────────── page error ──────────────────────────── */

function PageError({
  pageNum,
  onRetry,
}: {
  pageNum: number;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto flex h-[600px] w-[480px] flex-col items-center justify-center gap-3 rounded-control border border-hairline bg-surface">
      <AlertTriangle className="h-8 w-8 text-clay-deep" />
      <p className="font-reading text-sm text-ink">
        Failed to render page {pageNum}
      </p>
      <button
        onClick={onRetry}
        className="rounded-control bg-surface px-3 py-1.5 font-display text-xs font-medium text-ink transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
      >
        Retry
      </button>
    </div>
  );
}

/* ──────────────────────────── search overlay ──────────────────────────── */

function SearchOverlay({
  query,
  onClose,
  onQueryChange,
}: {
  query: string;
  onClose: () => void;
  onQueryChange: (q: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="absolute right-3 top-3 z-30 flex items-center gap-2 rounded-control border border-hairline bg-surface px-3 py-2 shadow-md">
      <Search className="h-4 w-4 text-text-muted" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search in document…"
        className="w-48 bg-transparent font-reading text-sm text-ink outline-none placeholder:text-cloud"
      />
      <button
        onClick={onClose}
        className="rounded p-0.5 hover:bg-oat"
        aria-label="Close search"
      >
        <X className="h-3.5 w-3.5 text-text-muted" />
      </button>
    </div>
  );
}

/* ──────────────────────────── main component ──────────────────────────── */

export function PdfViewer({
  fileUrl,
  totalPages,
  onPageChange,
  currentPage,
  zoom,
  searchQuery: externalSearchQuery,
  isOcrInProgress = false,
  extractedText,
  pagesData,
  onSaveEdits,
}: PdfViewerProps) {
  const [viewMode, setViewMode] = useState<"canvas" | "text" | "edit">("canvas");
  const [viewSourceMode, setViewSourceMode] = useState<"original" | "working">("original");
  const [searchOpen, setSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState("");
  const [loadingPages, setLoadingPages] = useState<Set<number>>(
    new Set([currentPage]),
  );
  const [errorPages, setErrorPages] = useState<Set<number>>(new Set());
  const [editableText, setEditableText] = useState(extractedText || "");
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [saveSuccessMessage, setSaveSuccessMessage] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activePageText = pagesData?.find((p) => p.page_number === currentPage)?.text || extractedText || "";

  useEffect(() => {
    if (extractedText || activePageText) {
      setEditableText(extractedText || activePageText);
    }
  }, [extractedText, activePageText]);

  const handleSaveWorkingCopy = async () => {
    if (!onSaveEdits) return;
    setIsSavingLocal(true);
    try {
      await onSaveEdits(editableText);
      setSaveSuccessMessage("Working copy compiled & saved via ReportLab!");
      setTimeout(() => setSaveSuccessMessage(null), 3500);
    } catch {
      // Handled upstream
    } finally {
      setIsSavingLocal(false);
    }
  };

  const searchQuery = externalSearchQuery ?? internalQuery;
  const baseWidth = 680;
  const baseHeight = 880;
  const scaledWidth = Math.round(baseWidth * zoom);
  const scaledHeight = Math.round(baseHeight * zoom);

  // Keyboard shortcut: Ctrl+F for search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchOpen]);

  // Simulate page loaded after a short delay (since we use iframe)
  useEffect(() => {
    const timeout = setTimeout(() => {
      setLoadingPages((prev) => {
        const next = new Set(prev);
        next.delete(currentPage);
        return next;
      });
    }, 600);
    return () => clearTimeout(timeout);
  }, [currentPage]);

  const goToPage = useCallback(
    (p: number) => {
      if (p >= 1 && p <= totalPages) {
        setLoadingPages((prev) => new Set(prev).add(p));
        setErrorPages((prev) => {
          const next = new Set(prev);
          next.delete(p);
          return next;
        });
        onPageChange(p);
      }
    },
    [onPageChange, totalPages],
  );

  const retryPage = useCallback(
    (p: number) => {
      setErrorPages((prev) => {
        const next = new Set(prev);
        next.delete(p);
        return next;
      });
      setLoadingPages((prev) => new Set(prev).add(p));
      // Trigger a re-render by touching page
      onPageChange(p);
    },
    [onPageChange],
  );

  const handleMouseUp = () => {
    if (typeof window === "undefined") return;
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 3) {
      const selectedText = selection.toString().trim();
      const parts = fileUrl.split("/");
      const docId = parts[3] || "pdf-doc";
      window.dispatchEvent(
        new CustomEvent("draythos:selection-changed", {
          detail: {
            documentId: docId,
            sourceFilename: `Page ${currentPage} Passage`,
            selectedText,
            pageNumber: currentPage,
          },
        })
      );
    }
  };

  return (
    <div className="relative flex h-full flex-col" onMouseUp={handleMouseUp}>
      {/* OCR banner */}
      {isOcrInProgress && (
        <div className="flex items-center gap-2 border-b border-hairline bg-manilla px-4 py-2">
          <Loader2 className="h-4 w-4 animate-spin text-clay-deep" />
          <span className="font-reading text-xs text-clay-deep">
            Scanned document — OCR in progress, text will be available shortly
          </span>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <SearchOverlay
          query={searchQuery}
          onClose={() => setSearchOpen(false)}
          onQueryChange={setInternalQuery}
        />
      )}

      {/* PDF render area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto bg-canvas p-4"
      >
        {viewMode === "edit" ? (
          <div className="mx-auto max-w-3xl flex flex-col h-full min-h-[500px] bg-surface border border-hairline rounded-[var(--radius-card)] shadow-xs overflow-hidden">
            {/* Edit Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-oat/40 shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="h-4 w-4 text-clay" />
                <span className="font-display font-semibold text-xs text-ink uppercase tracking-wider">
                  PDF Working Copy Editor
                </span>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-manilla text-clay-deep border border-clay/20">
                  Original file is immutable
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditableText((prev) => `${prev.trim()}\n\n### New Section\nEnter details here...\n`)}
                  className="px-2.5 py-1 rounded-[var(--radius-control)] bg-surface border border-hairline text-xs font-display text-ink hover:bg-oat transition-colors flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add Section
                </button>
                <button
                  type="button"
                  onClick={handleSaveWorkingCopy}
                  disabled={isSavingLocal}
                  className="px-3 py-1 rounded-[var(--radius-control)] bg-clay text-canvas hover:bg-clay-deep text-xs font-display font-medium shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSavingLocal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save Working Copy
                </button>
              </div>
            </div>

            {saveSuccessMessage && (
              <div className="px-4 py-2 bg-manilla/70 border-b border-clay/20 text-xs font-reading text-clay-deep flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-clay shrink-0" />
                <span>{saveSuccessMessage}</span>
              </div>
            )}

            {/* Editable Content */}
            <div className="flex-1 p-4 flex flex-col">
              <p className="text-xs text-text-muted mb-2 font-reading">
                Edit the document content below. Saving compiles a brand-new PDF using ReportLab and saves an isolated versioned working copy.
              </p>
              <textarea
                value={editableText}
                onChange={(e) => setEditableText(e.target.value)}
                placeholder="Document text layer..."
                className="w-full flex-1 min-h-[360px] p-3 rounded-lg border border-hairline bg-canvas font-mono text-xs leading-relaxed text-ink resize-none focus:outline-none focus:border-clay"
              />
            </div>
          </div>
        ) : viewMode === "text" ? (
          <div className="mx-auto max-w-3xl bg-surface border border-hairline rounded-[var(--radius-card)] p-6 shadow-xs font-reading">
            <div className="flex items-center justify-between border-b border-hairline pb-3 mb-4">
              <div>
                <h3 className="font-display font-semibold text-sm text-ink">Extracted Document Layer (Page {currentPage})</h3>
                <p className="text-xs text-text-muted mt-0.5">Underlying OCR and RAG index evidence representation</p>
              </div>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-oat text-ink-soft">
                {pagesData?.find((p) => p.page_number === currentPage)?.confidence
                  ? `${Math.round((pagesData.find((p) => p.page_number === currentPage)?.confidence || 1) * 100)}% confidence`
                  : "Native text layer"}
              </span>
            </div>
            {activePageText ? (
              <div
                className="text-sm leading-relaxed text-ink space-y-3 whitespace-pre-wrap select-text"
                onMouseUp={() => {
                  if (typeof window === "undefined") return;
                  const sel = window.getSelection();
                  const text = sel ? sel.toString().trim() : "";
                  if (text.length > 0) {
                    window.dispatchEvent(
                      new CustomEvent("draythos:selection-changed", {
                        detail: {
                          documentId: "active-pdf",
                          sourceFilename: `Page ${currentPage}`,
                          pageNumber: currentPage,
                          sectionHeading: `PDF Page ${currentPage}`,
                          selectedText: text,
                        },
                      })
                    );
                  }
                }}
              >
                {activePageText}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No extracted text layer detected on this page.</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            {/* Render current page */}
            {errorPages.has(currentPage) ? (
              <div className="text-center space-y-3 p-8 bg-surface border border-hairline rounded-[var(--radius-card)]">
                <AlertTriangle className="h-8 w-8 text-clay mx-auto" />
                <p className="text-sm font-display text-ink">Native viewer unavailable in current browser mode.</p>
                <button
                  onClick={() => setViewMode("text")}
                  className="px-3 py-1.5 rounded-[var(--radius-control)] bg-clay text-canvas text-xs font-medium"
                >
                  View Extracted Text Layer
                </button>
              </div>
            ) : loadingPages.has(currentPage) ? (
              <PageSkeleton width={scaledWidth} height={scaledHeight} />
            ) : (
              <div
                className="mx-auto overflow-hidden rounded border border-hairline bg-white shadow-sm"
                style={{ width: scaledWidth, height: scaledHeight }}
              >
                <object
                  data={`${viewSourceMode === "original" ? `${fileUrl}?original=true` : fileUrl}#page=${currentPage}`}
                  type="application/pdf"
                  className="w-full h-full border-none"
                  style={{
                    width: scaledWidth,
                    height: scaledHeight,
                  }}
                >
                  <iframe
                    src={`${viewSourceMode === "original" ? `${fileUrl}?original=true` : fileUrl}#page=${currentPage}`}
                    title={`PDF page ${currentPage}`}
                    className="border-none w-full h-full"
                    style={{
                      width: scaledWidth,
                      height: scaledHeight,
                    }}
                  />
                </object>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom bar: page navigation & view mode toggle */}
      <div className="flex items-center justify-between border-t border-hairline bg-surface px-4 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-oat/50 p-0.5 rounded-[var(--radius-control)] border border-hairline text-xs font-display">
            <button
              onClick={() => setViewMode("canvas")}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === "canvas" ? "bg-surface shadow-xs text-ink font-medium" : "text-text-muted hover:text-ink"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Canvas
            </button>
            <button
              onClick={() => setViewMode("text")}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === "text" ? "bg-surface shadow-xs text-ink font-medium" : "text-text-muted hover:text-ink"
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Text / OCR
            </button>
            <button
              onClick={() => setViewMode("edit")}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                viewMode === "edit" ? "bg-surface shadow-xs text-clay font-medium" : "text-text-muted hover:text-ink"
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Working Copy
            </button>
          </div>

          {/* Original vs Working Copy View Selector */}
          <div className="flex items-center gap-1 bg-oat/40 p-0.5 rounded-[var(--radius-control)] border border-hairline text-[11px] font-display">
            <button
              type="button"
              onClick={() => setViewSourceMode("original")}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewSourceMode === "original"
                  ? "bg-surface text-ink font-medium shadow-xs"
                  : "text-text-muted hover:text-ink"
              }`}
              title="View original uploaded PDF layout exactly as created"
            >
              Original Source
            </button>
            <button
              type="button"
              onClick={() => setViewSourceMode("working")}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewSourceMode === "working"
                  ? "bg-surface text-clay font-medium shadow-xs"
                  : "text-text-muted hover:text-ink"
              }`}
              title="View versioned working copy"
            >
              Working Copy
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-control p-1 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="font-mono text-xs text-ink">
            Page{" "}
            <span className="font-semibold">{currentPage}</span>{" "}
            of {totalPages}
          </span>

          <button
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-control p-1 text-ink-soft transition-colors hover:bg-oat disabled:opacity-40 focus:outline-2 focus:outline-ink focus:outline-offset-[3px]"
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen((p) => !p)}
            className={`ml-2 rounded-control p-1 transition-colors hover:bg-oat focus:outline-2 focus:outline-ink focus:outline-offset-[3px] ${searchOpen ? "bg-oat text-ink" : "text-ink-soft"}`}
            aria-label="Search document"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PdfViewer;
