"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import { CoMark } from "@/components/co-mark";
import { WorkerPills } from "@/components/jobs/worker-pills";
import { UsageMeter } from "@/components/usage-meter";
import { NAV_ITEMS, isActivePath } from "@/lib/nav-items";
import { useJobs } from "@/components/jobs/job-store";

const STYLE = `
.co-mscrim{position:fixed;inset:0;z-index:60;background:rgba(8,8,12,.45);-webkit-backdrop-filter:blur(2px);backdrop-filter:blur(2px);opacity:0;pointer-events:none;transition:opacity var(--md-sys-motion-duration-medium) var(--md-sys-motion-easing-standard)}
.co-mscrim.open{opacity:1;pointer-events:auto}
.co-mdrawer{position:fixed;top:0;right:0;bottom:0;z-index:61;width:min(20rem,86vw);display:flex;flex-direction:column;overflow-y:auto;overscroll-behavior:contain;background:var(--md-sys-color-surface-container);transform:translateX(102%);transition:transform .34s var(--md-sys-motion-easing-emphasized-decelerate);will-change:transform;padding-top:calc(env(safe-area-inset-top) + .25rem)}
.co-mdrawer.open{transform:translateX(0)}
@media(prefers-reduced-motion:reduce){.co-mdrawer,.co-mscrim{transition:none}}
`;

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  const { jobs } = useJobs();
  const running = jobs.filter((j) => j.status === "running").length;

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <style>{STYLE}</style>
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface)] px-4 py-3 xl:hidden">
        <Link href="/" className="flex min-h-[48px] items-center gap-2" aria-label="career-ops home">
          <CoMark size={26} />
          <span className="md-title-medium text-[var(--md-sys-color-on-surface)]">career-ops</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="relative ml-auto inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-on-surface-variant)]"
        >
          <MaterialSymbol name="menu" size={24} />
          {running > 0 && (
            <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-[var(--md-sys-color-primary)]" />
          )}
        </button>
      </header>

      <div className={cn("co-mscrim xl:hidden", open && "open")} onClick={() => setOpen(false)} aria-hidden />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        inert={!open}
        className={cn("co-mdrawer xl:hidden", open && "open")}
        data-lenis-prevent
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span className="md-title-medium text-[var(--md-sys-color-on-surface)]">Menu</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="inline-flex min-h-[48px] min-w-[48px] items-center justify-center">
            <MaterialSymbol name="close" size={24} />
          </button>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {NAV_ITEMS.map(({ href, label, icon, chip }) => {
            const active = isActivePath(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[48px] items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] px-3 md-body-large transition-colors",
                  active
                    ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]"
                    : "text-[var(--md-sys-color-on-surface-variant)] hover:bg-[var(--md-sys-color-surface-container-high)]",
                )}
              >
                <MaterialSymbol name={icon} filled={active} size={22} />
                {label}
                {chip && (
                  <span className="ml-auto rounded-[var(--md-sys-shape-corner-full)] bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 md-label-small text-[var(--md-sys-color-on-tertiary-container)]">
                    {chip}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="px-3">
          <WorkerPills />
        </div>

        <div className="mt-auto space-y-3 border-t border-[var(--md-sys-color-outline-variant)] px-4 py-4">
          <UsageMeter />
        </div>
      </aside>
    </>
  );
}
