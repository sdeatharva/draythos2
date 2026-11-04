"use client";

import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "status" | "format";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-oat text-ink-soft",
  status: "bg-clay/15 text-clay-deep",
  format: "bg-surface text-text-muted border border-hairline",
};

export function Badge({
  variant = "default",
  children,
  className,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-display font-medium",
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

