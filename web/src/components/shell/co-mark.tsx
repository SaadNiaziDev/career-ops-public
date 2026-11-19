import { robotoFlex } from "@/lib/fonts";
import { cn } from "@/lib/cn";

export function CoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        robotoFlex.className,
        "inline-flex shrink-0 items-center justify-center rounded-[var(--md-sys-shape-corner-large-increased)] bg-[var(--md-sys-color-primary)] font-bold text-[var(--md-sys-color-on-primary)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.45),
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}
    >
      co
    </span>
  );
}
