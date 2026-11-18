"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "lavender";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-forest text-paper hover:bg-forest-deep hover:-translate-y-px active:scale-[0.98] shadow-xs focus-visible:outline-forest",
  secondary:
    "bg-transparent text-forest border border-forest hover:bg-forest/5 hover:-translate-y-px active:scale-[0.98] focus-visible:outline-forest",
  outline:
    "bg-transparent text-ink border border-hairline hover:bg-oat active:scale-[0.98] focus-visible:outline-ink",
  ghost:
    "bg-transparent text-ink hover:bg-oat active:scale-[0.98] focus-visible:outline-ink",
  lavender:
    "bg-lavender text-ink hover:opacity-90 active:scale-[0.98] shadow-xs focus-visible:outline-ink",
  destructive:
    "bg-error text-white hover:bg-error/90 active:scale-[0.98] focus-visible:outline-error",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs gap-1.5 rounded-full",
  md: "h-12 px-6 text-sm gap-2 rounded-full",
  lg: "h-14 px-8 text-base gap-2.5 rounded-full",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
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
          "inline-flex items-center justify-center font-ui font-medium transition-all duration-180 ease-out cursor-pointer",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:active:scale-100",
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
