"use client";

import React, { useCallback, useRef, useState } from "react";
import { Upload, X, FileWarning, CheckCircle2 } from "lucide-react";
import { BouncingDots } from "@/components/ui/bouncing-dots";

/* ──────────────────────────── types ──────────────────────────── */

export interface RejectedFile {
  name: string;
  reason: string;
}

export interface UploadZoneProps {
  onUpload: (file: File) => void | Promise<void>;
  isUploading?: boolean;
  progress?: number; // 0-100
  acceptedFormats?: string[]; // e.g. [".pdf",".xlsx",".docx",".csv",".json",".xml",".txt"]
  maxSizeMB?: number;
}

/* ──────────────────────────── defaults ──────────────────────────── */

const DEFAULT_FORMATS = [
  ".pdf",
  ".xlsx",
  ".xls",
  ".csv",
  ".docx",
  ".doc",
  ".txt",
  ".json",
  ".xml",
];

const DEFAULT_MAX_MB = 50;

/* ──────────────────────────── component ──────────────────────────── */

export function UploadZone({
  onUpload,
  isUploading = false,
  progress = 0,
  acceptedFormats = DEFAULT_FORMATS,
  maxSizeMB = DEFAULT_MAX_MB,
}: UploadZoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  /* ── validation ── */
  const validate = useCallback(
    (file: File): string | null => {
      const ext = "." + file.name.split(".").pop()?.toLowerCase();
      if (!acceptedFormats.includes(ext)) {
        return `Unsupported format (${ext})`;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        return `Exceeds ${maxSizeMB}MB limit`;
      }
      return null;
    },
    [acceptedFormats, maxSizeMB],
  );

  const processFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;
      const accepted: File[] = [];
      const newRejected: RejectedFile[] = [];

      Array.from(fileList).forEach((f) => {
        const reason = validate(f);
        if (reason) newRejected.push({ name: f.name, reason });
        else accepted.push(f);
      });

      setRejected(newRejected);
      if (accepted.length > 0) {
        accepted.forEach((f) => onUpload(f));
      }
    },
    [onUpload, validate],
  );

  /* ── drag events ── */
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    setIsDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragActive(false);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragActive(false);
      processFiles(e.dataTransfer.files);
    },
    [processFiles],
  );

  const handleClick = () => inputRef.current?.click();

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (inputRef.current) inputRef.current.value = "";
  };

  /* ── render ── */
  return (
    <div className="flex flex-col gap-2">
      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files"
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleClick();
        }}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onDragOver={onDragOver}
        onDrop={onDrop}
        className={`
          relative flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed
          px-6 py-10 text-center transition-all duration-200
          focus:outline-2 focus:outline-ink focus:outline-offset-[3px]
          ${
            isDragActive
              ? "border-clay bg-oat"
              : "border-hairline bg-surface hover:border-cloud-dark hover:bg-canvas"
          }
          ${isUploading ? "pointer-events-none opacity-70" : "cursor-pointer"}
        `}
      >
        <Upload
          className={`h-8 w-8 ${isDragActive ? "text-clay" : "text-cloud-dark"}`}
        />

        <div className="flex flex-col gap-1">
          <p className="font-display text-sm font-semibold text-ink">
            {isDragActive
              ? "Drop files here"
              : "Drop files here or click to browse"}
          </p>
          <p className="font-reading text-xs text-text-muted">
            Supported: {acceptedFormats.join(", ")} — max {maxSizeMB}MB each
          </p>
        </div>

        {/* Upload progress & bouncing indicator */}
        {isUploading && (
          <div className="mt-3 flex flex-col items-center gap-2.5 w-full max-w-xs">
            <BouncingDots size="sm" />
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-oat">
              <div
                className="h-full rounded-full bg-clay transition-all duration-300"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <p className="font-mono text-xs text-text-muted">
              Uploading & indexing… {Math.round(progress)}%
            </p>
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptedFormats.join(",")}
        onChange={handleInputChange}
        className="hidden"
      />

      {/* Rejected files */}
      {rejected.length > 0 && (
        <div className="flex flex-col gap-1.5 rounded-control border border-hairline bg-surface px-3 py-2">
          {rejected.map((r, i) => (
            <div
              key={`${r.name}-${i}`}
              className="flex items-center gap-2 text-xs"
            >
              <FileWarning className="h-3.5 w-3.5 shrink-0 text-clay-deep" />
              <span className="truncate font-mono text-ink">{r.name}</span>
              <span className="shrink-0 text-clay-deep">{r.reason}</span>
              <button
                onClick={() =>
                  setRejected((prev) => prev.filter((_, idx) => idx !== i))
                }
                className="ml-auto shrink-0 rounded p-0.5 hover:bg-oat"
                aria-label={`Dismiss ${r.name} error`}
              >
                <X className="h-3 w-3 text-text-muted" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
