"use client";

import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import type { BrainState } from "@/lib/brain";

export type BrainResult = { ok: true; state: BrainState } | { ok: false; error: string };

/** POST to /api/brain; returns the fresh state or a friendly error. */
export async function brainPost(body: Record<string, unknown>): Promise<BrainResult> {
  try {
    const res = await fetch("/api/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as BrainState & { error?: string };
    if (!res.ok) return { ok: false, error: data.error || "Couldn't save that." };
    return { ok: true, state: data };
  } catch {
    return { ok: false, error: "Couldn't reach the server." };
  }
}

export async function profilePost(fields: Record<string, unknown>): Promise<string | null> {
  try {
    const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error || "Couldn't save that.";
  } catch {
    return "Couldn't reach the server.";
  }
}

export function Meter({ value, className, label }: { value: number; className?: string; label?: string }) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[var(--md-sys-color-surface-container-highest)]", className)}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full bg-[var(--md-sys-color-primary)] transition-[width] duration-500 ease-out"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function SectionPercent({ value }: { value: number }) {
  const done = value >= 100;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 md-label-medium tabular-nums",
        done
          ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
          : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]",
      )}
    >
      {done ? <MaterialSymbol name="check" size={16} /> : null}
      {value}%
    </span>
  );
}

export function BrainSection({
  id,
  icon,
  title,
  description,
  percent,
  children,
}: {
  id: string;
  icon: string;
  title: string;
  description: ReactNode;
  percent?: number;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-24 rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4 sm:p-6"
    >
      <header className="mb-4 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]">
          <MaterialSymbol name={icon} size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="md-title-large text-[var(--md-sys-color-on-surface)]">{title}</h2>
          <p className="mt-0.5 text-sm text-[var(--md-sys-color-on-surface-variant)]">{description}</p>
        </div>
        {percent !== undefined ? <SectionPercent value={percent} /> : null}
      </header>
      {children}
    </section>
  );
}

export function FieldLabel({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="mb-1.5 block">
      <span className="block text-sm font-medium text-[var(--md-sys-color-on-surface)]">{children}</span>
      {hint ? <span className="block text-xs text-[var(--md-sys-color-on-surface-variant)]">{hint}</span> : null}
    </span>
  );
}
