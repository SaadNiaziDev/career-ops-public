import type { ReactNode, MouseEvent } from "react";
import { cn } from "@/lib/cn";

export function Md3SelectableCard({
  selected = false,
  disabled = false,
  onSelect,
  children,
  className,
}: {
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
  children: ReactNode;
  className?: string;
}) {
  const handleClick = (e: MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("a, button, input, select, textarea, [data-stop-select]")) return;
    onSelect?.();
  };

  return (
    <div
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      className={cn(
        "md3-selectable-card",
        selected && "md3-selectable-card--selected",
        disabled && "md3-selectable-card--disabled",
        className,
      )}
    >
      {children}
    </div>
  );
}
