"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

export function Md3Collapse({
  title,
  children,
  defaultOpen = false,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("md3-collapse", className)}>
      <button type="button" className="md3-collapse__header" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="min-w-0 flex-1 text-left">{title}</span>
        <MaterialSymbol name="expand_more" size={22} className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? <div className="md3-collapse__body">{children}</div> : null}
    </section>
  );
}
