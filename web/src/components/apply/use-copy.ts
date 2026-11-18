"use client";

import { useCallback } from "react";
import { useToast } from "@/components/providers/toast-provider";

/** Copy text to the clipboard and confirm with a toast (falls back to a hidden textarea). */
export function useCopy() {
  const { toast } = useToast();
  return useCallback(
    async (text: string, message = "Copied") => {
      if (!text.trim()) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.style.position = "fixed";
        area.style.opacity = "0";
        document.body.appendChild(area);
        area.select();
        const ok = document.execCommand("copy");
        area.remove();
        if (!ok) {
          toast({ message: "Couldn't reach the clipboard. Select the text and copy it.", tone: "error" });
          return;
        }
      }
      toast({ message, tone: "neutral" });
    },
    [toast],
  );
}
