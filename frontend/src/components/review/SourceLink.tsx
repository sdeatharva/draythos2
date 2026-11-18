"use client";

import React, { useState } from "react";
import { ExternalLink, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceLinkProps {
  locator: {
    type?: string;
    sheet?: string;
    cell?: string;
    page?: number;
    bbox?: number[];
    row?: number;
    col?: number;
    quote?: string;
    doc_id?: string;
  };
  className?: string;
}

export function formatLocator(loc: any): string {
  if (!loc || typeof loc !== "object") return "unavailable";
  const t = loc.type;
  if (t === "xlsx" || t === "xls") {
    return `${loc.sheet || "Sheet1"}!${loc.cell || "A1"}`;
  }
  if (t === "pdf") {
    return `p.${loc.page || 1}`;
  }
  if (t === "csv") {
    return `r${loc.row || 1}c${loc.col || 1}`;
  }
  if (t === "docx") {
    if (loc.table_index !== undefined) {
      return `table.${loc.table_index + 1}:r${loc.row}c${loc.col}`;
    }
    return `para.${loc.para_index || 0}`;
  }
  if (t === "txt") {
    return `line.${loc.line || 1}`;
  }
  return loc.type ? `${loc.type}` : "source";
}

export function SourceLink({ locator, className }: SourceLinkProps) {
  const [copied, setCopied] = useState(false);
  const display = formatLocator(locator);
  const quote = locator?.quote || "";

  const handleCopyQuote = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quote) {
      navigator.clipboard.writeText(quote);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleClickLocator = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("draythos:open-locator", { detail: locator })
      );
    }
  };

  return (
    <div
      onClick={handleClickLocator}
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-mono px-1.5 py-0.5 rounded-[4px] bg-surface border border-hairline text-secondary hover:border-secondary hover:text-primary transition-colors cursor-pointer group select-none",
        className
      )}
      title={quote ? `Source quote: "${quote}" (Click to view)` : undefined}
    >
      <span className="tabular truncate max-w-[140px]">[{display}]</span>
      {quote && (
        <button
          onClick={handleCopyQuote}
          className="text-muted hover:text-primary p-0.5 rounded transition-colors"
          title="Copy verbatim citation quote"
        >
          {copied ? <Check className="w-3 h-3 text-positive" /> : <Copy className="w-3 h-3" />}
        </button>
      )}
    </div>
  );
}
