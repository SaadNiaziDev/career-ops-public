"use client";

import { MaterialSymbol } from "@/components/material-symbol";
import { useTheme } from "@/components/providers/theme-provider";
import { cn } from "@/lib/cn";

export function ThemeToggle({ className }: { className?: string }) {
  const { isDark, setTheme, theme } = useTheme();

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]",
        className,
      )}
    >
      <MaterialSymbol name={isDark ? "light_mode" : "dark_mode"} size={22} />
      {theme === "system" && <span className="sr-only"> (system)</span>}
    </button>
  );
}
