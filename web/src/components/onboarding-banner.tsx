"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

type Doctor = { available: boolean; onboardingNeeded: boolean; missing: string[]; warnings: string[] };

const SETUP_LINKS: Record<string, { label: string; href: string }> = {
  "cv.md": { label: "Add your CV", href: "/cv" },
  "config/profile.yml": { label: "Complete profile", href: "/config" },
  "modes/_profile.md": { label: "Personalize targeting", href: "/config" },
  "portals.yml": { label: "Set up portals", href: "/portals" },
};

const LABELS: Record<string, string> = {
  "cv.md": "your CV",
  "config/profile.yml": "your profile — target roles, comp, location",
  "modes/_profile.md": "your personalization",
  "portals.yml": "the companies to scan",
};

export function OnboardingBanner() {
  const [d, setD] = useState<Doctor | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/doctor")
      .then((r) => r.json())
      .then(setD)
      .catch(() => {});
  }, []);

  if (dismissed || !d || !d.onboardingNeeded) return null;
  const items = d.missing.map((m) => LABELS[m] ?? m);
  const primary = d.missing.map((m) => SETUP_LINKS[m]).find(Boolean);

  return (
    <div className="page-shell max-w-6xl pb-0!">
      <div className="dot-bg relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-br from-brand/10 via-surface/40 to-transparent p-5">
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 text-faint transition-colors hover:text-foreground"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
        <h2 className="font-display text-xl text-landing">Let&apos;s finish setting you up</h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted">
          career-ops works best when it knows you. We still need {items.join(", ")}.
        </p>
        {primary && (
          <Link
            href={primary.href}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-medium text-brand-foreground transition-colors hover:bg-brand-200"
          >
            {primary.label} <ArrowRight className="size-4" />
          </Link>
        )}
      </div>
    </div>
  );
}
