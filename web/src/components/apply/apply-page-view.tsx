"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { OutreachView } from "@/components/outreach/outreach-view";
import type { OutreachRecord } from "@/lib/outreach-shared";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
import { useApply } from "@/components/apply/apply-provider";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { Md3Segmented } from "@/components/ui/md3-segmented";
import { Md3Empty } from "@/components/ui/md3-empty";
import type { ApplyKit, QueueItem } from "@/lib/apply/kit";
import { ApplyKitPanel } from "./apply-kit";
import { ApplyQueue } from "./apply-queue";
import { KitStyles } from "./kit-styles";

export type ApplyPageMode = "queue" | "kit" | "form" | "email";

const LAST_KIT_KEY = "career-ops:apply-last-kit";

/**
 * /apply            → the queue (evaluated 4.0+ roles not yet applied)
 * /apply?n=<num>    → the Apply kit for one tracker row
 * /apply?view=form  → paste any application form URL (the live form reader)
 */
export function ApplyPageView({ mode, n, kit, queue, emails }: { mode: ApplyPageMode; n: string; kit: ApplyKit | null; queue: QueueItem[]; emails: OutreachRecord[] }) {
  const router = useRouter();
  const apply = useApply();
  const [lastKit, setLastKit] = useState<string>("");

  useEffect(() => {
    try {
      if (mode === "kit" && kit) localStorage.setItem(LAST_KIT_KEY, kit.app.n);
      setLastKit(localStorage.getItem(LAST_KIT_KEY) || "");
    } catch {
      /* per-viewer convenience */
    }
  }, [mode, kit]);

  const kitN = mode === "kit" ? n : apply.trackerNum || lastKit;
  const options = [
    { value: "queue" as const, label: <span className="inline-flex items-center gap-1.5"><MaterialSymbol name="format_list_bulleted" size={18} className="hidden sm:inline-block" />Queue{queue.length ? <span className="tabular-nums opacity-70">{queue.length}</span> : null}</span> },
    ...(kitN ? [{ value: "kit" as const, label: <span className="inline-flex items-center gap-1.5"><MaterialSymbol name="inventory_2" size={18} className="hidden sm:inline-block" />Kit #{kitN}</span> }] : []),
    { value: "email" as const, label: "Email drafts" },
    { value: "form" as const, label: <span className="inline-flex items-center gap-1.5"><MaterialSymbol name="link" size={18} className="hidden sm:inline-block" />Any form</span> },
  ];
  const go = (next: ApplyPageMode) => router.push(next === "queue" ? "/apply" : next === "kit" ? `/apply?n=${kitN}` : next === "email" ? "/apply?view=email" : "/apply?view=form");

  const liveElsewhere = mode !== "form" && apply.status !== "idle" && (!apply.trackerNum || (mode === "kit" && apply.trackerNum !== n));

  return (
    <div className="apply-workspace relative min-h-screen">
      {mode === "form" && <ApplyBackdropMount />}
      <KitStyles />
      <div className="relative z-10">
        <PageShell width={mode === "email" ? "wide" : "narrow"}>
          <DossierStack>
            <div data-co-tour="apply-intro">
              <DossierPageHeader
                title={
                  <span className="inline-flex items-center gap-3">
                    <MaterialSymbol name="send" size={24} className="text-[var(--md-sys-color-primary)]" />
                    Apply
                  </span>
                }
                description={
                  mode === "form"
                    ? "Paste any application form. career-ops reads it on your machine, drafts every answer from your CV, and fills the real form for you to review. It never submits."
                    : "One kit per role: tailored CV, drafted answers, a cover letter when the form asks for one. You review, open the application and click Submit yourself."
                }
              />
            </div>

            <Md3Segmented aria-label="Apply view" value={mode} onChange={go} options={options} className="apply-workspace-tabs w-full sm:w-auto" />

            {liveElsewhere && (
              <Link href={apply.trackerNum ? `/apply?n=${apply.trackerNum}` : "/apply?view=form"} className="md3-alert md3-alert--info text-sm no-underline">
                <MaterialSymbol name="sync" size={18} className={apply.status === "opening" || apply.status === "prefilling" || apply.status === "filling" || apply.status === "driving" ? "shrink-0 animate-spin" : "shrink-0"} />
                <span className="min-w-0 flex-1 truncate">
                  A form is open{apply.title ? `: ${apply.title}` : ""}{apply.trackerNum ? ` (#${apply.trackerNum})` : ""}.
                </span>
                <span className="shrink-0 font-medium">View</span>
              </Link>
            )}

            {mode === "email" && <OutreachView initialItems={emails} picks={[]} embedded />}
            {mode === "queue" && <ApplyQueue initialQueue={queue} />}
            {mode === "kit" &&
              (kit ? (
                <ApplyKitPanel key={kit.app.n} initialKit={kit} />
              ) : (
                <Md3Empty icon="search_off" description={/^\d+$/.test(n) ? `No tracker row #${n}.` : "That isn't a tracker number."}>
                  <Link href="/apply" className="md3-action-btn md3-action-btn--outlined mt-4">
                    <span className="md3-action-btn__label">Back to the queue</span>
                  </Link>
                </Md3Empty>
              ))}
            {mode === "form" && (
              <div data-co-tour="apply-form">
                <ApplyView />
              </div>
            )}
          </DossierStack>
        </PageShell>
      </div>
    </div>
  );
}
