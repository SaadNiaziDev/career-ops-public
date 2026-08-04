import type { ReactNode } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

export function Md3Empty({
  icon = "inbox",
  description,
  children,
  className,
}: {
  icon?: string;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("md3-empty", className)}>
      <MaterialSymbol name={icon} size={40} className="text-[var(--md-sys-color-outline)]" />
      {description ? <p className="mt-3 md-body-medium text-[var(--md-sys-color-on-surface-variant)]">{description}</p> : null}
      {children}
    </div>
  );
}
