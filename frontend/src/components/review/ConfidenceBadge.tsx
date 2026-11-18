"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  confidence: number;
  state: string;
  className?: string;
}

export function ConfidenceBadge({ confidence, state, className }: ConfidenceBadgeProps) {
  const pct = Math.round(confidence * 100);

  if (state === "user_confirmed") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-xs font-mono text-primary bg-surface border border-hairline tabular",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        Confirmed
      </span>
    );
  }

  if (state === "rejected") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-xs font-mono text-negative bg-negative/10 border border-negative/20 tabular",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-negative" />
        Rejected
      </span>
    );
  }

  if (state === "conflict") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-xs font-mono text-secondary bg-raised border border-hairline tabular",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-muted" />
        Conflict ({pct}%)
      </span>
    );
  }

  if (state === "auto_accepted" || pct >= 80) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-xs font-mono text-positive bg-positive/10 border border-positive/20 tabular",
          className
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-positive" />
        {pct}%
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[4px] text-xs font-mono text-accent bg-accent/10 border border-accent/20 tabular",
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-accent" />
      {pct}%
    </span>
  );
}
