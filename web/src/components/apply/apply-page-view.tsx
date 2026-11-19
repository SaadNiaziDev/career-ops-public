"use client";

import Link from "next/link";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Empty } from "@/components/ui/md3-empty";
import type { ApplyKit, QueueItem } from "@/lib/apply/kit";
import type { MachineSummary } from "@/lib/format";
import { ApplyKitPanel } from "./apply-kit";
import { ApplyQueue } from "./apply-queue";
import { EvaluationSummary } from "./evaluation-summary";
import { KitStyles } from "./kit-styles";

export type ApplyPageMode = "queue" | "kit" | "form";

export function ApplyPageView({ mode, n, kit, queue, summary }: { mode: ApplyPageMode; n: string; kit: ApplyKit | null; queue: QueueItem[]; summary: MachineSummary | null }) {
  if (mode === "queue") return <ApplyQueue initialQueue={queue} />;

  return (
    <div className="apply-workspace relative min-h-screen">
      {mode === "form" && <ApplyBackdropMount />}
      <KitStyles />
      <div className="search-page relative z-10">
        <Link href="/apply" className="apply-back"><MaterialSymbol name="arrow_back" size={18} />All roles to apply</Link>
        {mode === "form" ? (
          <>
            <header className="search-head">
              <div>
                <h1 className="md-headline-medium">Fill an application form</h1>
                <p className="search-sub">Paste any application form. It reads the form on your machine, drafts every answer from your CV, and fills it for you to review. It never submits.</p>
              </div>
            </header>
            <div className="apply-form-wrap"><ApplyView /></div>
          </>
        ) : kit ? (
          <div className="apply-grid">
            <div className="min-w-0"><ApplyKitPanel key={kit.app.n} initialKit={kit} /></div>
            <EvaluationSummary n={kit.app.n} summary={summary} url={kit.app.url} />
          </div>
        ) : (
          <Md3Empty icon="search_off" description={/^\d+$/.test(n) ? `No application #${n}.` : "That isn't an application number."} />
        )}
      </div>
    </div>
  );
}
