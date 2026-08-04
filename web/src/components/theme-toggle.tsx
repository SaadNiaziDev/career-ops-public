"use client";

import { useEffect, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";

const KEY = "career-ops:theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", next ? "#191211" : "#191211");
    try {
      localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={cn(
        "inline-flex min-h-[48px] min-w-[48px] items-center justify-center rounded-[var(--md-sys-shape-corner-full)] text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-surface-container-high)]",
        className,
      )}
    >
      <MaterialSymbol name={dark ? "light_mode" : "dark_mode"} size={22} />
    </button>
  );
}
