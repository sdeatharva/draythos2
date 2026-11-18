"use client";

import { cn } from "@/lib/utils";

export type BadgeVariant = "default" | "forest" | "lavender" | "status" | "format";

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-oat text-ink-soft border border-hairline",
  forest: "bg-forest text-paper",
  lavender: "bg-lavender text-ink font-medium border border-lavender/60",
  status: "bg-success-soft text-success border border-success/20",
  format: "bg-surface text-ink-soft border border-hairline font-mono",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-ui font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
