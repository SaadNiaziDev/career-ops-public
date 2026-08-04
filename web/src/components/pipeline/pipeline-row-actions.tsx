"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";

type MenuItem = {
  key: string;
  icon: string;
  label: string;
  href?: string;
  onClick?: () => void;
  dividerBefore?: boolean;
};

export function PipelineRowActions({
  n,
  company,
  role,
}: {
  n: string;
  company: string;
  role: string;
}) {
  const { jobs, startJob } = useJobs();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [menuStyle, setMenuStyle] = useState<{ top: number; left: number; width: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const busy = jobs.some((j) => j.input === n && j.status === "running");

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMenuStyle({
        top: rect.bottom + 4,
        left: Math.max(8, rect.right - 200),
        width: 200,
      });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const run = (kind: string, title: string) => {
    const id = startJob({ title, subtitle: role, kind, input: n, page: `/pipeline/${n}` });
    if (id) setToast(`Started ${title.toLowerCase()} — see Workers.`);
    setOpen(false);
  };

  const items: MenuItem[] = [
    { key: "view", icon: "visibility", label: "Open report", href: `/pipeline/${n}` },
    { key: "pdf", icon: "description", label: "Generate CV PDF", onClick: () => run("pdf", `CV PDF · ${company}`), dividerBefore: true },
    { key: "cover", icon: "description", label: "Cover letter", onClick: () => run("cover", `Cover · ${company}`) },
    { key: "email", icon: "mail", label: "Application email", onClick: () => run("email", `Email · ${company}`) },
    { key: "contacto", icon: "group", label: "Find contacts", onClick: () => run("contacto", `Contacts · ${company}`) },
  ];

  const menu =
    open && menuStyle && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="fixed z-[var(--z-dropdown)] min-w-[200px] overflow-hidden rounded-[var(--md-sys-shape-corner-medium)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] py-1 shadow-lg"
            style={{ top: menuStyle.top, left: menuStyle.left, width: menuStyle.width }}
          >
            {items.map((item) => (
              <div key={item.key}>
                {item.dividerBefore ? (
                  <div className="my-1 border-t border-[var(--md-sys-color-outline-variant)]" role="separator" />
                ) : null}
                {item.href ? (
                  <Link
                    href={item.href}
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    onClick={() => setOpen(false)}
                  >
                    <MaterialSymbol name={item.icon} size={18} />
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--md-sys-color-on-surface)] hover:bg-[var(--md-sys-color-surface-container-highest)]"
                    onClick={item.onClick}
                  >
                    <MaterialSymbol name={item.icon} size={18} />
                    {item.label}
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className="relative">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Row actions"
          aria-expanded={open}
          aria-haspopup="menu"
          disabled={busy}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          <MaterialSymbol name="more_vert" size={20} />
        </Button>
      </div>
      {menu}
      {toast ? (
        <p
          className={cn(
            "md3-alert md3-alert--info pointer-events-none fixed bottom-6 left-1/2 z-[var(--z-toast)] max-w-md -translate-x-1/2 shadow-lg",
          )}
          role="status"
        >
          {toast}
        </p>
      ) : null}
    </>
  );
}
