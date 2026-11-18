"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Code2, Loader2, ChevronDown } from "lucide-react";

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
      a.download = `draythos_export_${Date.now()}.${extensions[format]}`;
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

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-4 text-xs bg-primary text-paper hover:bg-forest-deep rounded-full flex items-center gap-1.5 font-medium transition-all shadow-xs cursor-pointer"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Export</span>
        <ChevronDown className="w-3 h-3 ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-52 rounded-lg bg-surface border border-hairline shadow-md z-50 p-1 space-y-0.5">
          <button
            onClick={() => handleExport("xlsx")}
            disabled={downloading === "xlsx"}
            className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-primary hover:bg-raised rounded-md transition-colors"
          >
            {downloading === "xlsx" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-muted" />
            )}
            <div>
              <div className="font-medium">Consolidated Excel (.xlsx)</div>
              <div className="text-[11px] text-muted">7-tab canonical matrix</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("csv")}
            disabled={downloading === "csv"}
            className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-primary hover:bg-raised rounded-md transition-colors"
          >
            {downloading === "csv" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-muted" />
            )}
            <div>
              <div className="font-medium">CSV table (.csv)</div>
              <div className="text-[11px] text-muted">Flat facts with quotes</div>
            </div>
          </button>

          <button
            onClick={() => handleExport("json")}
            disabled={downloading === "json"}
            className="w-full text-left flex items-center gap-2.5 px-2.5 py-1.5 text-xs text-primary hover:bg-raised rounded-md transition-colors"
          >
            {downloading === "json" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted" />
            ) : (
              <Code2 className="w-3.5 h-3.5 text-muted" />
            )}
            <div>
              <div className="font-medium">JSON payload (.json)</div>
              <div className="text-[11px] text-muted">Raw verified locators</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}
