"use client";

// Visual pieces of the Apply kit: one numbered step and the keyboard shortcut hint.
import { useEffect, useRef } from "react";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import type { StepState } from "@/lib/apply/kit";
import { cn } from "@/lib/cn";

export function KitShortcuts({ onPrepare, onOpen }: { onPrepare: () => void; onOpen: () => void }) {
  const ref = useRef({ onPrepare, onOpen });
  ref.current = { onPrepare, onOpen };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.shiftKey && e.key === "P") ref.current.onPrepare();
      if (e.shiftKey && e.key === "O") ref.current.onOpen();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <p className="hidden px-1 text-[11px] text-[var(--md-sys-color-outline)] sm:block">
      Shortcuts: <kbd className="font-mono">Shift P</kbd> prepare everything · <kbd className="font-mono">Shift O</kbd> open the application
    </p>
  );
}

export function Step({
  index,
  state,
  title,
  icon,
  detail,
  children,
}: {
  index: number;
  state: StepState;
  title: string;
  icon: string;
  detail: React.ReactNode;
  children?: React.ReactNode;
}) {
  const stateLabel = { done: "Done", running: "In progress", todo: "To do", blocked: "Blocked", skipped: "Not needed" }[state];
  return (
    <li className="co-kit-step" aria-label={`${title}: ${stateLabel}`}>
      <span className="co-kit-dot" data-state={state} aria-hidden>
        {state === "done" ? (
          <MaterialSymbol name="check" size={18} />
        ) : state === "running" ? (
          <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
        ) : state === "skipped" ? (
          <MaterialSymbol name="remove" size={16} />
        ) : state === "blocked" ? (
          <MaterialSymbol name="block" size={16} />
        ) : (
          <MaterialSymbol name={icon} size={18} />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <h3 className="text-[15px] font-semibold text-[var(--md-sys-color-on-surface)]">
            <span className="sr-only">Step {index}: </span>
            {title}
          </h3>
          <span className={cn("text-xs", state === "done" ? "text-[var(--md-sys-color-primary)]" : "text-[var(--md-sys-color-outline)]")}>{stateLabel}</span>
        </div>
        <div className="mt-0.5 text-sm text-[var(--md-sys-color-on-surface-variant)]">{detail}</div>
        {children && <div className="co-kit-actions">{children}</div>}
      </div>
    </li>
  );
}
