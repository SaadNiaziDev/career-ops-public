"use client";

import { SendOutlined } from "@ant-design/icons";
import { ApplyView } from "@/components/apply-view";
import { ApplyBackdropMount } from "@/components/apply/apply-backdrop-mount";
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
            <DossierPageHeader
              title={
                <span className="inline-flex items-center gap-3">
                  <SendOutlined className="text-[var(--ant-color-primary)]" />
                  Apply
                </span>
              }
              description="career-ops reads the real application form on your machine and re-renders it here in plain language, pre-filled from your CV. You verify every answer — then it fills the real form behind the scenes and you submit it yourself. It never submits for you."
            />
            <ApplyView />
          </DossierStack>
        </PageShell>
      </div>
    </div>
  );
}
