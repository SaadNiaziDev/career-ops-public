import { MaterialSymbol } from "@/components/material-symbol";
import { COST_META, type CostClass } from "@/lib/explore-cost";
import { cn } from "@/lib/cn";

export function CostBadge({
  kind,
  size = "sm",
  className = "",
}: {
  kind: CostClass;
  size?: "xs" | "sm";
  className?: string;
}) {
  const tone = kind === "spend" ? "spend" : "free";
  const icon =
    kind === "spend" ? "toll" : kind === "free-gemini" ? "auto_awesome" : "eco";
  const meta = COST_META[kind];

  return (
    <span
      className={cn("co-cost", className)}
      data-tone={tone}
      data-size={size}
      title={meta.tip}
    >
      <MaterialSymbol name={icon} size={size === "xs" ? 12 : 14} />
      {meta.label}
    </span>
  );
}
