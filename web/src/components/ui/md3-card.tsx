import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Md3Card({
  children,
  className,
  title,
  extra,
}: {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]",
        className,
      )}
    >
      {(title != null || extra != null) && (
        <header className="flex items-center justify-between gap-3 px-[var(--card-pad-x)] py-4">
          {title != null && <div className="min-w-0">{title}</div>}
          {extra != null && <div className="shrink-0">{extra}</div>}
        </header>
      )}
      <div className={cn(title != null || extra != null ? "px-[var(--card-pad-x)] pb-[var(--card-pad-y)]" : "p-[var(--card-pad-y)] px-[var(--card-pad-x)]")}>
        {children}
      </div>
    </section>
  );
}
