"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Md3SegmentOption<T extends string> = {
  value: T;
  label: ReactNode;
};

export function Md3Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Md3SegmentOption<T>[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("md3-segmented inline-flex max-w-full", className)} role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            className="md3-segmented-btn min-h-[44px] shrink-0"
            data-active={active ? "true" : "false"}
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
