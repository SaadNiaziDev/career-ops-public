import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";

/** Today-page nudge into the outreach loop: drafts waiting + follow-ups due. Hidden when there's nothing to do. */
export function OutreachStrip({ ready, due }: { ready: number; due: number }) {
  if (!ready && !due) return null;
  const parts = [ready ? `${ready} email${ready === 1 ? "" : "s"} ready to send` : "", due ? `${due} follow-up${due === 1 ? "" : "s"} due` : ""].filter(Boolean);
  return (
    <Link
      href="/apply?view=email"
      className="flex items-center gap-3 rounded-2xl bg-[var(--md-sys-color-primary-container)] px-4 py-3 text-[var(--md-sys-color-on-primary-container)] hover:opacity-90"
    >
      <MaterialSymbol name="outgoing_mail" size={20} />
      <span className="flex-1 text-sm font-medium">{parts.join(" · ")}</span>
      <span className="text-sm">Open outreach</span>
      <MaterialSymbol name="arrow_forward" size={18} />
    </Link>
  );
}
