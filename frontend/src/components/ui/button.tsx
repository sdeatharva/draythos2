"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-clay text-ink hover:bg-clay/90 active:bg-clay-deep focus-visible:outline-ink",
  secondary:
    "bg-surface text-ink border border-hairline hover:border-ink-soft/30 active:bg-oat focus-visible:outline-ink",
  ghost:
    "bg-transparent text-ink hover:bg-oat/50 active:bg-oat focus-visible:outline-ink",
  destructive:
    "bg-clay-deep text-surface hover:bg-clay-deep/90 active:bg-clay-deep focus-visible:outline-clay-deep",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-[var(--radius-control)]",
  md: "h-11 px-4 text-sm gap-2 rounded-[var(--radius-control)]",
  lg: "h-12 px-6 text-base gap-2.5 rounded-[var(--radius-control)]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "secondary",
      size = "md",
      isLoading = false,
      iconLeft,
      iconRight,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          "inline-flex items-center justify-center font-display font-medium transition-colors duration-150",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          iconLeft
        )}
        {children}
        {!isLoading && iconRight}
      </button>
    );
  }
);
Button.displayName = "Button";

