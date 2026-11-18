"use client";

import { useState, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { DocumentTab, DocumentReference } from "@/types";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DocumentToolbar } from "./document-toolbar";
import { DocumentPreview } from "./document-preview";
import {
  FileText,
  X,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Circle,
  ExternalLink,
} from "lucide-react";

interface ArtifactsPaneProps {
  tabs: DocumentTab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onTabClose: (id: string) => void;
  onSave: (documentId: string, edits: any, format: string) => Promise<any>;
  onDownload: (documentId: string, filename: string, source?: "original" | "working") => Promise<void>;
  getContent: (documentId: string) => Promise<any>;
  availableDocuments?: DocumentReference[];
  onOpenDocument?: (doc: DocumentReference) => void;
}

const stateIcons: Record<string, React.ReactNode> = {
  queued: <Clock className="h-3 w-3 text-cloud-dark" />,
  processing: <Loader2 className="h-3 w-3 text-ink-soft animate-spin" />,
  ready: <CheckCircle2 className="h-3 w-3 text-ink" />,
  unsupported: <AlertTriangle className="h-3 w-3 text-text-muted" />,
  failed: <XCircle className="h-3 w-3 text-clay-deep" />,
  edited: <Circle className="h-3 w-3 text-clay fill-clay" />,
};

export function ArtifactsPane({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onSave,
  onDownload,
  getContent,
  availableDocuments = [],
  onOpenDocument,
}: ArtifactsPaneProps) {
  const [content, setContent] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEdits, setPendingEdits] = useState<any>(null);
  const [zoom, setZoom] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewSource, setViewSource] = useState<"working" | "original">("working");

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const fetchContent = useCallback(
    async (docId: string, source: "working" | "original" = "working") => {
      setIsLoading(true);
      setError(null);
      try {
        const url =
          source === "original"
            ? `/api/documents/${docId}/content?version=original`
            : `/api/documents/${docId}/content`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load document content");
        const data = await res.json();
        setContent(data);
        setCurrentPage(1);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Load content when active tab changes
  useEffect(() => {
    if (!activeTabId) {
      setContent(null);
      setPendingEdits(null);
      return;
    }
    setViewSource("working");
    fetchContent(activeTabId, "working");
  }, [activeTabId, fetchContent]);

  // Live auto-refresh when an AI prompt edit creates or updates a working copy
  useEffect(() => {
    const handleDocUpdated = (e: any) => {
      const docId = e.detail?.documentId;
      if (activeTabId && (!docId || docId === activeTabId)) {
        setViewSource("working");
        fetchContent(activeTabId, "working");
      }
    };
    window.addEventListener("draythos:document-updated", handleDocUpdated);
    return () => window.removeEventListener("draythos:document-updated", handleDocUpdated);
  }, [activeTabId, fetchContent]);

  const handleSave = useCallback(async () => {
    if (!activeTab) return;
    setIsSaving(true);
    try {
      await onSave(
        activeTab.id,
        pendingEdits || {},
        activeTab.documentRef.format
      );
      setPendingEdits(null);
      activeTab.hasUnsavedChanges = false;
      // Reload updated working copy content from server
      const updated = await getContent(activeTab.id);
      setContent(updated);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  }, [activeTab, pendingEdits, onSave, getContent]);

  const handleDownload = useCallback(
    async (type: "original" | "working" = "working") => {
      if (!activeTab) return;
      await onDownload(activeTab.id, activeTab.documentRef.source_filename, type);
    },
    [activeTab, onDownload]
  );

  const handleIncomingEdits = useCallback((edits: any) => {
    setPendingEdits((prev: any) => {
      if (Array.isArray(edits)) {
        const prevList = Array.isArray(prev) ? prev : [];
        const map = new Map<string, any>();
        for (const e of prevList) {
          const key = `${e.sheet_name || ""}:${e.cell_ref || ""}`;
          map.set(key, e);
        }
        for (const e of edits) {
          const key = `${e.sheet_name || ""}:${e.cell_ref || ""}`;
          map.set(key, e);
        }
        return Array.from(map.values());
      }
      return edits;
    });
    if (activeTab) {
      activeTab.hasUnsavedChanges = true;
    }
  }, [activeTab]);

  if (tabs.length === 0) {
    if (availableDocuments && availableDocuments.length > 0 && onOpenDocument) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-canvas text-center">
          <div className="w-12 h-12 rounded-2xl bg-oat flex items-center justify-center mx-auto mb-4 border border-hairline">
            <FileText className="h-6 w-6 text-clay" />
          </div>
          <h3 className="font-display font-semibold text-base text-ink mb-1">
            Session Documents
          </h3>
          <p className="font-reading text-xs text-ink-soft mb-6 max-w-xs">
            Select an attached document from this session to open, inspect, and edit in the Artifact Canvas:
          </p>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {availableDocuments.map((doc) => (
              <button
                key={doc.document_id}
                onClick={() => onOpenDocument(doc)}
                className="flex items-center justify-between p-3 rounded-xl border border-hairline bg-surface hover:bg-oat text-left transition-colors shadow-xs group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="p-1.5 rounded-lg bg-oat text-clay group-hover:bg-surface">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="font-display text-xs font-medium text-ink truncate">
                    {doc.source_filename || doc.filename || "Document"}
                  </span>
                </div>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-oat text-ink-soft border border-hairline">
                  {doc.format || "doc"}
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="h-full flex items-center justify-center bg-canvas">
        <EmptyState
          icon={<FileText className="h-12 w-12" />}
          title="No documents open"
          description="Attach a document to see it here. Upload PDFs, spreadsheets, or Word documents."
        />
      </div>
    );
  }

  const totalPages = content?.total_pages || content?.pages?.length || 1;

  return (
    <div className="flex flex-col h-full bg-canvas">
      {/* ── Tab Bar ── */}
      <div className="flex border-b border-hairline bg-surface overflow-x-auto shrink-0">
        <div className="flex items-center min-w-0">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 border-r border-hairline cursor-pointer",
                "text-sm font-display transition-colors shrink-0 max-w-[220px]",
                "hover:bg-oat/30",
                tab.id === activeTabId
                  ? "bg-oat text-ink border-b-2 border-b-clay"
                  : "text-ink-soft"
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              {stateIcons[tab.state]}
              <span className="truncate">{tab.label}</span>
              <Badge variant="format" className="text-[10px] px-1.5 py-0 uppercase">
                {tab.documentRef.format}
              </Badge>
              {tab.id === activeTabId && (
                <span
                  className="text-[9px] font-mono font-medium px-1 rounded bg-clay/15 text-clay-deep border border-clay/30 shrink-0"
                  title="Active Edit Target: Prompt modifications target this document"
                >
                  Target
                </span>
              )}
              {(tab.hasUnsavedChanges || (tab.id === activeTabId && pendingEdits !== null)) && (
                <span className="h-2 w-2 rounded-full bg-clay shrink-0" title="Unsaved changes" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="ml-1 p-0.5 rounded hover:bg-hairline/50 transition-colors shrink-0"
                aria-label={`Close ${tab.label}`}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Document Toolbar ── */}
      {activeTab && (
        <DocumentToolbar
          document={activeTab.documentRef}
          format={activeTab.documentRef.format}
          hasUnsavedChanges={activeTab.hasUnsavedChanges || pendingEdits !== null}
          isSaving={isSaving}
          onSave={handleSave}
          onDownload={handleDownload}
          zoom={zoom}
          onZoomChange={setZoom}
          page={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          viewSource={viewSource}
          onViewSourceChange={(mode) => {
            setViewSource(mode);
            if (activeTabId) fetchContent(activeTabId, mode);
          }}
        />
      )}

      {/* ── Document Preview Area ── */}
      <div className="flex-1 overflow-auto">
        {error ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<XCircle className="h-10 w-10 text-clay-deep" />}
              title="Failed to load document"
              description={error}
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setError(null);
                    if (activeTabId) {
                      setIsLoading(true);
                      getContent(activeTabId)
                        .then(setContent)
                        .catch((err) => setError(err.message))
                        .finally(() => setIsLoading(false));
                    }
                  }}
                >
                  Retry
                </Button>
              }
            />
          </div>
        ) : activeTab ? (
          <DocumentPreview
            document={activeTab.documentRef}
            content={content}
            format={activeTab.documentRef.format}
            isLoading={isLoading}
            onSaveEdits={handleIncomingEdits}
            onTriggerSave={handleSave}
          />
        ) : null}
      </div>
    </div>
  );
}
