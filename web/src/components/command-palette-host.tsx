"use client";

import { useCallback } from "react";
import { CommandPalette } from "@/components/command-palette";

export function CommandPaletteHost() {
  const onExport = useCallback(() => {
    window.open("/api/export?kind=tracker", "_blank");
  }, []);

  return <CommandPalette onExport={onExport} />;
}
