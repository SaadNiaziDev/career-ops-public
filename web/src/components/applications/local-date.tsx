"use client";

import { useEffect, useState } from "react";

/** Keep server/client markup identical, then show the viewer's local time. */
export function LocalDate({ value, dateOnly = false, className }: { value: string; dateOnly?: boolean; className?: string }) {
  const [label, setLabel] = useState(value.slice(0, 10));
  useEffect(() => {
    const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
    setLabel(Number.isFinite(date.getTime())
      ? date.toLocaleString(undefined, { dateStyle: "medium", ...(!dateOnly && value.includes("T") ? { timeStyle: "short" as const } : {}) })
      : value);
  }, [value, dateOnly]);
  return <time dateTime={value} className={className}>{label}</time>;
}
