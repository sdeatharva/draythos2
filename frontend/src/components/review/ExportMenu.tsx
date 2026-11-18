"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Code2, Loader2, ChevronDown, CheckSquare } from "lucide-react";

interface ExportMenuProps {
  docId?: string;
}

export function ExportMenu({ docId }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = async (format: "xlsx" | "csv" | "json") => {
    setDownloading(format);
    try {
      const url = `/api/export/${format}${docId ? `?doc_id=${docId}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      const extensions = { xlsx: "xlsx", csv: "csv", json: "json" };
      a.download = `draythos_board_audit_${Date.now()}.${extensions[format]}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setDownloading(null);
      setIsOpen(false);
    }
  };

  const handlePrintAuditPdf = () => {
    window.print();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-4 text-xs bg-forest text-paper hover:bg-forest-deep rounded-full flex items-center gap-1.5 font-medium transition-all shadow-xs cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Board-Ready Export</span>
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 rounded-xl bg-surface border border-hairline shadow-lg z-50 p-1.5 text-xs">
            <button
              onClick={() => handleExport("xlsx")}
              disabled={!!downloading}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-forest" />
              <div>
                <div className="font-semibold text-ink">Consolidated Excel (.xlsx)</div>
                <div className="text-[10px] text-neutral-500">Formula AST & multi-sheet citations</div>
              </div>
            </button>

            <button
              onClick={handlePrintAuditPdf}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <FileText className="w-4 h-4 text-forest" />
              <div>
                <div className="font-semibold text-ink">Board-Ready PDF Report</div>
                <div className="text-[10px] text-neutral-500">Exact citations with locator appendix</div>
              </div>
            </button>

            <button
              onClick={() => handleExport("csv")}
              disabled={!!downloading}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-forest" />
              <div>
                <div className="font-semibold text-ink">Verified Facts CSV</div>
                <div className="text-[10px] text-neutral-500">Maker-checker approval ledger</div>
              </div>
            </button>

            <button
              onClick={() => handleExport("json")}
              disabled={!!downloading}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-neutral-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Code2 className="w-4 h-4 text-forest" />
              <div>
                <div className="font-semibold text-ink">Taxonomy & Graph JSON</div>
                <div className="text-[10px] text-neutral-500">Full provenance graph</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
