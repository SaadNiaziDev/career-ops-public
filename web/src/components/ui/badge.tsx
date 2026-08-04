import { cn } from "@/lib/cn";

export function Badge({
  className,
  tone = "muted",
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: "good" | "warn" | "bad" | "muted";
}) {
  const tones = {
    good: "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)]",
    warn: "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
    bad: "bg-[var(--md-sys-color-error-container)] text-[var(--md-sys-color-on-error-container)]",
    muted: "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]",
  } as const;

  return (
    <span
      className={cn(
        "inline-flex min-h-[24px] items-center justify-center rounded-[var(--md-sys-shape-corner-small)] px-2 md-label-medium tabular-nums",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
