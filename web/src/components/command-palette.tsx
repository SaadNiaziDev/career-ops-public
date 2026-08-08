"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { NAV_ITEMS } from "@/lib/nav-items";
import { cn } from "@/lib/cn";

type PaletteItem = {
  id: string;
  group: string;
  label: string;
  icon: string;
  href?: string;
  action?: () => void;
  tokens?: boolean;
  score?: string;
  company?: string;
  role?: string;
  status?: string;
};

export function CommandPalette({
  jobs = [],
  onExport,
}: {
  jobs?: { num: string; company: string; role: string; score: string; status: string }[];
  onExport?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nav: PaletteItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.href}`,
      group: "Navigate",
      label: n.label,
      icon: n.icon,
      href: n.href,
    }));
    const actions: PaletteItem[] = [
      { id: "export", group: "Actions", label: "Export tracker as CSV", icon: "download", action: onExport },
      { id: "scan", group: "Actions", label: "Run portal scan", icon: "radar", href: "/explore" },
      { id: "add", group: "Actions", label: "Paste a job URL", icon: "link", href: "/add" },
    ];
    const jobItems: PaletteItem[] = jobs.map((j) => ({
      id: `job-${j.num}`,
      group: "Jobs",
      label: j.company,
      icon: "work",
      href: `/pipeline/${j.num}`,
      company: j.company,
      role: j.role,
      status: j.status,
      score: j.score,
    }));
    const all = [...actions, ...nav, ...jobItems];
    if (!q) return all;
    return all.filter((it) => {
      const hay = `${it.label} ${it.company ?? ""} ${it.role ?? ""} ${it.status ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [jobs, onExport, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, PaletteItem[]>();
    for (const it of items) {
      const list = map.get(it.group) ?? [];
      list.push(it);
      map.set(it.group, list);
    }
    return map;
  }, [items]);

  const flat = useMemo(() => Array.from(grouped.values()).flat(), [grouped]);

  const run = useCallback(
    (item: PaletteItem) => {
      setOpen(false);
      setQuery("");
      if (item.action) {
        item.action();
        return;
      }
      if (item.href) router.push(item.href);
    },
    [router],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (!open) return;
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, flat.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && flat[active]) {
        e.preventDefault();
        run(flat[active]);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, flat, open, run]);

  useEffect(() => {
    if (open) {
      setActive(0);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  if (!open) return null;

  let idx = 0;

  return (
    <div className="fixed inset-0 z-[var(--z-overlay)] flex items-start justify-center bg-black/45 px-4 pt-16">
      <button type="button" className="absolute inset-0" aria-label="Close command palette" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-[660px] overflow-hidden rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container-high)]">
        <div className="flex h-16 items-center gap-3 border-b border-[var(--md-sys-color-outline-variant)] px-[22px]">
          <MaterialSymbol name="search" size={24} className="text-[var(--md-sys-color-outline)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions and jobs…"
            className="min-w-0 flex-1 border-none bg-transparent text-lg text-[var(--md-sys-color-on-surface)] outline-none placeholder:text-[var(--md-sys-color-outline)]"
          />
          <kbd className="rounded-md bg-[var(--md-sys-color-surface-container-highest)] px-2 py-1 font-mono text-[11px] text-[var(--md-sys-color-on-surface-variant)]">
            esc
          </kbd>
        </div>

        <div className="max-h-[min(420px,60vh)] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-[22px] py-8 text-center text-sm text-[var(--md-sys-color-on-surface-variant)]">No matches</p>
          ) : (
            Array.from(grouped.entries()).map(([group, list]) => (
              <div key={group}>
                <p className="px-[22px] py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--md-sys-color-outline)]">
                  {group}
                  {group === "Jobs" ? ` · ${list.length} match${list.length === 1 ? "" : "es"}` : ""}
                </p>
                {list.map((item) => {
                  const i = idx++;
                  const selected = i === active;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => run(item)}
                      className={cn(
                        "flex w-full items-center gap-3 px-[22px] text-left",
                        item.company ? "min-h-14" : "min-h-[52px]",
                        selected && "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
                      )}
                    >
                      {item.company ? (
                        <CompanyLogo name={item.company} size={36} className="shrink-0" />
                      ) : (
                        <MaterialSymbol
                          name={item.icon}
                          size={22}
                          filled={selected}
                          className={selected ? "text-[var(--md-sys-color-on-secondary-container)]" : "text-[var(--md-sys-color-on-surface-variant)]"}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium">{item.label}</span>
                        {item.role && (
                          <span className="block truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">
                            {item.role}
                            {item.status ? ` · ${item.status}` : ""}
                          </span>
                        )}
                      </span>
                      {item.tokens && (
                        <span className="rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 text-[11px] font-semibold text-[var(--md-sys-color-on-tertiary-container)]">
                          TOKENS
                        </span>
                      )}
                      {item.score && (
                        <span className="font-bold tabular-nums text-[var(--md-sys-color-primary)]">{item.score}</span>
                      )}
                      {selected && !item.company && (
                        <kbd className="rounded-md bg-[var(--md-sys-color-surface-container-highest)] px-2 py-1 font-mono text-[11px]">↵</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex h-11 items-center gap-[18px] border-t border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] px-[22px] text-xs text-[var(--md-sys-color-outline)]">
          <span>
            <kbd className="font-mono text-[var(--md-sys-color-on-surface-variant)]">↑↓</kbd> navigate
          </span>
          <span>
            <kbd className="font-mono text-[var(--md-sys-color-on-surface-variant)]">↵</kbd> run
          </span>
          <span>
            <kbd className="font-mono text-[var(--md-sys-color-on-surface-variant)]">⌘K</kbd> anywhere
          </span>
          <span className="ml-auto">
            Free unless marked{" "}
            <span className="font-semibold text-[var(--md-sys-color-on-tertiary-container)]">TOKENS</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
      className="hidden items-center gap-2 rounded-[var(--md-sys-shape-corner-full)] border border-[var(--md-sys-color-outline-variant)] px-3 py-2 text-sm text-[var(--md-sys-color-on-surface-variant)] xl:inline-flex"
    >
      <MaterialSymbol name="search" size={18} />
      <span>Search</span>
      <kbd className="font-mono text-[11px]">⌘K</kbd>
    </button>
  );
}
