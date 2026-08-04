"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CostBadge } from "@/components/cost/cost-badge";
import type { CostClass } from "@/lib/explore-cost";
import { cn } from "@/lib/cn";

type Variant = "filled" | "outlined" | "text";

export function Md3ActionButton({
  variant = "outlined",
  icon,
  cost,
  children,
  className,
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  icon?: string;
  cost?: CostClass;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cn(
        "md3-action-btn",
        variant === "filled" && "md3-action-btn--filled",
        variant === "outlined" && "md3-action-btn--outlined",
        variant === "text" && "md3-action-btn--text",
        className,
      )}
      {...props}
    >
      {loading ? (
        <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
      ) : icon ? (
        <MaterialSymbol name={icon} size={18} />
      ) : null}
      {children ? <span className="md3-action-btn__label">{children}</span> : null}
      {cost ? <CostBadge kind={cost} size="xs" className="md3-action-btn__cost" /> : null}
    </button>
  );
}
