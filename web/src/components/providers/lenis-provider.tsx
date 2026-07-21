"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ReactLenis, useLenis } from "lenis/react";

function LenisRouteSync() {
  const pathname = usePathname();
  const lenis = useLenis();

  useEffect(() => {
    lenis?.scrollTo(0, { immediate: true, force: true });
  }, [pathname, lenis]);

  return null;
}

export function LenisProvider({ children }: { children: React.ReactNode }) {
  const [motionOk, setMotionOk] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setMotionOk(!mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (!motionOk) return <>{children}</>;

  return (
    <ReactLenis
      root
      options={{
        lerp: 0.085,
        smoothWheel: true,
        anchors: true,
        autoRaf: true,
        wheelMultiplier: 0.9,
        touchMultiplier: 1.1,
      }}
    >
      <LenisRouteSync />
      {children}
    </ReactLenis>
  );
}
