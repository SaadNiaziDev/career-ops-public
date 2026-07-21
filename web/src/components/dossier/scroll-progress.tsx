"use client";

import { useState } from "react";
import { useLenis } from "lenis/react";

/** Thin brand bar — reads Lenis scroll progress (0–1). */
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);

  useLenis(({ progress: p }) => {
    setProgress(p);
  });

  return (
    <div
      aria-hidden
      className="lenis-scroll-progress"
      style={{ transform: `scaleX(${Math.max(0, Math.min(1, progress))})` }}
    />
  );
}
