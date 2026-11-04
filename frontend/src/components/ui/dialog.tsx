"use client";

import {
  type ReactNode,
  useEffect,
  useRef,
  useCallback,
} from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  // Focus trap and escape handling
  useEffect(() => {
    if (open) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialogRef.current?.focus();
    } else {
      previousFocus.current?.focus();
    }
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
      // Simple focus trap
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-desc" : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={cn(
          "relative z-10 w-full max-w-lg bg-surface rounded-[var(--radius-card)] border border-hairline p-6",
          "shadow-lg animate-in fade-in zoom-in-95 duration-200",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && (
              <h2
                id="dialog-title"
                className="text-lg font-display font-semibold text-ink"
              >
                {title}
              </h2>
            )}
            {description && (
              <p id="dialog-desc" className="mt-1 text-sm text-ink-soft">
                {description}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[var(--radius-control)] text-cloud-dark hover:text-ink hover:bg-oat/50 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        {children}
      </div>
    </div>
  );
}

