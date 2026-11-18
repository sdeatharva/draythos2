"use client";

import React, { useState } from "react";
import type { DocumentReference, DocumentFormat } from "@/types";
import { PdfViewer } from "./pdf-viewer";
import { SpreadsheetEditor } from "./spreadsheet-editor";
import { DocxPreview } from "./docx-preview";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FileText, AlertCircle, Copy, Check } from "lucide-react";

interface DocumentPreviewProps {
  document: DocumentReference;
  content?: any;
  format?: DocumentFormat;
  onSaveEdits?: (edits: any) => void;
  onTriggerSave?: () => void;
  isLoading?: boolean;
}

export function DocumentPreview({
  document: doc,
  content,
  format,
  onSaveEdits,
  onTriggerSave,
  isLoading = false,
}: DocumentPreviewProps) {
  const [copied, setCopied] = useState(false);
  const effectiveFormat = (format || doc.format || "unknown").toLowerCase();

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="p-8 space-y-4 max-w-4xl mx-auto">
        <Skeleton variant="card" className="h-16" />
        <Skeleton variant="text" className="w-3/4" />
        <Skeleton variant="text" className="w-1/2" />
        <Skeleton variant="table" className="h-96" />
      </div>
    );
  }

  // 1. PDF Preview
  if (effectiveFormat === "pdf") {
    const fileUrl = `/api/documents/${doc.document_id}/file`;
    const totalPages = content?.total_pages || content?.pages?.length || 1;

    return (
      <div className="h-full flex flex-col">
        <PdfViewer
          fileUrl={fileUrl}
          totalPages={totalPages}
          currentPage={1}
          zoom={1}
          onPageChange={() => {}}
          isOcrInProgress={doc.processing_status === "processing"}
          extractedText={content?.text}
          pagesData={content?.pages}
          onSaveEdits={onSaveEdits}
        />
      </div>
    );
  }

  // 2. Spreadsheet Preview & Editor
  if (effectiveFormat === "xlsx" || effectiveFormat === "xls" || effectiveFormat === "csv") {
    const modifiedCellsMap = Array.isArray(content?.modified_cells)
      ? Object.fromEntries(content.modified_cells.map((ref: string) => [ref, true]))
      : {};

    return (
      <SpreadsheetEditor
        workbookData={typeof content === "object" ? content : { text: String(content) }}
        editedCells={modifiedCellsMap}
        onCellEdit={(edit) => {
          if (onSaveEdits) onSaveEdits([edit]);
        }}
        onSaveEdits={onTriggerSave}
      />
    );
  }

  // 3. DOCX Preview
  if (effectiveFormat === "docx") {
    return (
      <DocxPreview
        content={content}
        isEditable={false}
      />
    );
  }

  // 4. Code / Structured Text (JSON, XML, TXT)
  const formattedText =
    typeof content === "string"
      ? content
      : content?.text || (content ? JSON.stringify(content, null, 2) : "");

  return (
    <div className="h-full bg-canvas p-6 overflow-auto">
      <div className="max-w-4xl mx-auto bg-surface rounded-[var(--radius-card)] border border-hairline shadow-xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-hairline bg-oat/30">
          <span className="font-display text-xs font-semibold text-ink uppercase tracking-wider">
            {effectiveFormat} Document
          </span>
          <button
            onClick={() => handleCopyText(formattedText)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-control)] bg-surface border border-hairline text-xs font-display text-ink hover:bg-oat transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-clay" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-text-muted" /> Copy Raw
              </>
            )}
          </button>
        </div>

        <div className="p-6">
          <pre className="font-mono text-xs leading-relaxed text-ink whitespace-pre-wrap overflow-x-auto">
            {formattedText || (
              <span className="text-cloud-dark italic font-reading">
                Document is currently empty or still parsing.
              </span>
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}

