"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 px-6 text-center",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-cloud-dark">{icon}</div>
      )}
      <h3 className="text-lg font-display font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-ink-soft font-reading max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

