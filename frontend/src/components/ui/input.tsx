"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-display font-medium text-ink"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-cloud-dark">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              "w-full h-11 rounded-[var(--radius-control)] bg-surface border border-hairline px-3",
              "text-ink font-display text-sm placeholder:text-cloud-dark",
              "focus-visible:outline-2 focus-visible:outline-ink focus-visible:outline-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150",
              icon && "pl-10",
              error && "border-clay-deep focus-visible:outline-clay-deep",
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="text-xs text-clay-deep font-display">{error}</p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";

