"use client";

import { cn } from "@/lib/cn";

export function Md3Switch({
  checked,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <label className={cn("md3-switch", className)}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={ariaLabel} />
      <span className="md3-switch__track" />
      <span className="md3-switch__thumb" />
    </label>
  );
}
