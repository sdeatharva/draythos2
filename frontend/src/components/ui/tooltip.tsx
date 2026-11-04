"use client";

import React, { useState, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: string;
  children: ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
  delayMs?: number;
}

export function Tooltip({
  content,
  children,
  position = "top",
  className,
  delayMs = 200,
}: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const show = () => {
    timeoutRef.current = setTimeout(() => setVisible(true), delayMs);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setVisible(false);
  };

  const positionClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {visible && (
        <div
          role="tooltip"
          className={cn(
            "absolute z-50 whitespace-nowrap rounded-[var(--radius-control)] bg-ink px-2.5 py-1 text-xs font-display text-surface shadow-md pointer-events-none animate-in fade-in zoom-in-95 duration-150",
            positionClasses[position],
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

