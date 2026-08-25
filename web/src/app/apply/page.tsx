"use client";

import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStack } from "@/components/dossier/dossier-stack";

export const dynamic = "force-dynamic";

export default function ApplyPage() {
  return (
    <div className="relative min-h-screen">
      <ApplyBackdropMount />
      <div className="relative z-10">
        <PageShell width="narrow">
          <DossierStack>
            <div data-co-tour="apply-intro">
              <DossierPageHeader
                title={
                  <span className="inline-flex items-center gap-3">
                    <MaterialSymbol name="send" size={24} className="text-[var(--md-sys-color-primary)]" />
                    Apply
                  </span>
                }
                description="career-ops reads the real application form on your machine and re-renders it here in plain language, pre-filled from your CV. You verify every answer — then it fills the real form behind the scenes and you submit it yourself. It never submits for you."
              />
            </div>
            <div data-co-tour="apply-form">
              <ApplyView />
            </div>
          </DossierStack>
        </PageShell>
      </div>
    </div>
  );
}
