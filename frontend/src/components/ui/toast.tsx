"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertTriangle, AlertCircle, Info } from "lucide-react";

type ToastVariant = "info" | "success" | "warning" | "error";

interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toast: (t: Omit<Toast, "id">) => void;
}

const ToastContext = createContext<ToastContextType>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

const icons: Record<ToastVariant, ReactNode> = {
  info: <Info className="h-4 w-4 text-ink-soft" />,
  success: <CheckCircle2 className="h-4 w-4 text-ink" />,
  warning: <AlertTriangle className="h-4 w-4 text-clay" />,
  error: <AlertCircle className="h-4 w-4 text-clay-deep" />,
};

const variantBorder: Record<ToastVariant, string> = {
  info: "border-hairline",
  success: "border-ink/20",
  warning: "border-clay/40",
  error: "border-clay-deep/40",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Omit<Toast, "id">) => {
    const id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const toast: Toast = { ...t, id };
    setToasts((prev) => [...prev, toast]);

    setTimeout(
      () => setToasts((prev) => prev.filter((x) => x.id !== id)),
      t.duration ?? 4000
    );
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}

      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={cn(
              "flex items-start gap-3 p-4 bg-surface rounded-[var(--radius-card)] border shadow-md",
              "animate-in slide-in-from-right duration-300",
              variantBorder[t.variant]
            )}
          >
            <div className="mt-0.5 shrink-0">{icons[t.variant]}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-medium text-ink">
                {t.title}
              </p>
              {t.description && (
                <p className="mt-0.5 text-xs text-ink-soft">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-0.5 text-cloud-dark hover:text-ink transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

