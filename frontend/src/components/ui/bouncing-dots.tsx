"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface BouncingDotsProps {
  /**
   * Dot size preset:
   * - "xs": 6px (ultra-compact, inline pills, micro-dialogs)
   * - "sm": 8px (dialogs, document upload status, toolbar buttons)
   * - "md": 12px (session pane loading, card placeholders)
   * - "lg": 18px (workspace full-screen buffer, main page transition)
   * - "xl": 24px (dramatic hero buffers)
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  label?: string;
  className?: string;
  fullScreen?: boolean;
}

const SIZE_CONFIGS = {
  xs: {
    dot: "w-1.5 h-1.5",
    gap: "gap-1",
    animationClass: "animate-draythos-bounce-xs",
    labelText: "text-[11px]",
  },
  sm: {
    dot: "w-2 h-2",
    gap: "gap-1.5",
    animationClass: "animate-draythos-bounce-sm",
    labelText: "text-xs",
  },
  md: {
    dot: "w-3 h-3",
    gap: "gap-2.5",
    animationClass: "animate-draythos-bounce-md",
    labelText: "text-xs md:text-sm",
  },
  lg: {
    dot: "w-4.5 h-4.5",
    gap: "gap-3.5",
    animationClass: "animate-draythos-bounce-lg",
    labelText: "text-sm md:text-base font-medium",
  },
  xl: {
    dot: "w-6 h-6",
    gap: "gap-4",
    animationClass: "animate-draythos-bounce-xl",
    labelText: "text-base md:text-lg font-medium",
  },
};

export function BouncingDots({
  size = "md",
  label,
  className,
  fullScreen = false,
}: BouncingDotsProps) {
  const cfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.md;

  const content = (
    <div className={cn("flex flex-col items-center justify-center gap-3 select-none", className)}>
      {/* 3 Translucent Clay / Reddish Bouncing Dots */}
      <div className={cn("flex items-center justify-center", cfg.gap)}>
        <span
          className={cn(
            "rounded-full bg-clay/60 dark:bg-clay/70 backdrop-blur-xs shadow-xs shadow-clay/20",
            cfg.dot,
            cfg.animationClass
          )}
          style={{ animationDelay: "0ms" }}
        />
        <span
          className={cn(
            "rounded-full bg-clay/60 dark:bg-clay/70 backdrop-blur-xs shadow-xs shadow-clay/20",
            cfg.dot,
            cfg.animationClass
          )}
          style={{ animationDelay: "180ms" }}
        />
        <span
          className={cn(
            "rounded-full bg-clay/60 dark:bg-clay/70 backdrop-blur-xs shadow-xs shadow-clay/20",
            cfg.dot,
            cfg.animationClass
          )}
          style={{ animationDelay: "360ms" }}
        />
      </div>

      {/* Optional contextual label */}
      {label && (
        <span
          className={cn(
            "font-display text-cloud-dark tracking-tight animate-pulse",
            cfg.labelText
          )}
        >
          {label}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-canvas select-none">
        {content}
      </div>
    );
  }

  return content;
}

