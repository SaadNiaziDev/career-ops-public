"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import { CoMark } from "@/components/co-mark";
import { WorkerTray } from "@/components/jobs/worker-sheet";
import { UsageMeter } from "@/components/usage-meter";
import { NavigationLinks } from "@/components/navigation-links";
import { useJobs } from "@/components/jobs/job-store";
import { useDialogFocus } from "@/lib/use-dialog-focus";

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
  useDialogFocus(open, panelRef);
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

        <nav aria-label="Primary" className="px-3 pb-3">
          <NavigationLinks layout="drawer" onNavigate={() => setOpen(false)} />
        </nav>

        <div className="border-t border-[var(--md-sys-color-outline-variant)] px-3 pt-3">
          <WorkerTray />
        </div>

        <div className="mt-auto space-y-3 border-t border-[var(--md-sys-color-outline-variant)] px-4 py-4">
          <UsageMeter />
        </div>
      </aside>
    </>
  );
}
