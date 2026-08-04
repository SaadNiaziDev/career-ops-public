import { cn } from "@/lib/cn";

export function MaterialSymbol({
  name,
  filled = false,
  className,
  size = 24,
}: {
  name: string;
  filled?: boolean;
  className?: string;
  size?: number;
}) {
  return (
    <span
      className={cn("material-symbols-outlined leading-none select-none", className)}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' ${filled ? 400 : 400}, 'GRAD' 0, 'opsz' 24`,
      }}
      aria-hidden
    >
      {name}
    </span>
  );
}
