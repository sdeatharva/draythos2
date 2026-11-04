"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circle" | "card" | "table";
}

export function Skeleton({
  variant = "text",
  className,
  ...props
}: SkeletonProps) {
  const variantStyles = {
    text: "h-4 w-full rounded",
    circle: "h-10 w-10 rounded-full",
    card: "h-32 w-full rounded-[var(--radius-card)]",
    table: "h-48 w-full rounded-[var(--radius-control)]",
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-oat/70 border border-hairline/40",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

