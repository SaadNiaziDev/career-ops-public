import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Vertical page sections — uses --block-gap from globals.css (no ad-hoc mt-*). */
export function DossierStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dossier-stack", className)}>{children}</div>;
}

/** Tighter rhythm inside cards and panels — uses --inset-gap. */
export function DossierInsetStack({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("dossier-inset-stack", className)}>{children}</div>;
}
