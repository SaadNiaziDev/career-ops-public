"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

export type ToastTone = "neutral" | "error";

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setItems((prev) => [...prev.slice(-4), { ...input, id }]);
      if (!input.action) {
        window.setTimeout(() => dismiss(id), 5000);
      }
      return id;
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 left-6 z-[var(--z-toast)] flex max-w-[min(420px,calc(100vw-2rem))] flex-col gap-2"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex min-h-[48px] items-center gap-3 rounded-[var(--md-sys-shape-corner-full)] px-4 py-2 shadow-none",
              t.tone === "error"
                ? "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]"
                : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface)]",
            )}
          >
            {t.tone === "error" && <MaterialSymbol name="error" size={20} className="shrink-0" />}
            <span className="min-w-0 flex-1 text-sm">{t.message}</span>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 font-medium text-[var(--md-sys-color-primary)]"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-full)] opacity-70 hover:opacity-100"
            >
              <MaterialSymbol name="close" size={18} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
