"use client";

import { MaterialSymbol } from "@/components/material-symbol";
import { PortalsView } from "@/components/portals-view";
import { TitlesBroadening } from "@/components/portals/titles-broadening";
import { PortalsHero } from "@/components/portals/portals-hero";
import { DossierSection } from "@/components/dossier/dossier-section";
import { DossierStack } from "@/components/dossier/dossier-stack";
import { PageShell } from "@/components/dossier/page-shell";

export const dynamic = "force-dynamic";

export default function PortalsPage() {
  return (
    <PageShell width="default">
      <DossierStack>
        <PortalsHero />
        <TitlesBroadening />
        <DossierSection
          icon={<MaterialSymbol name="radar" size={22} className="text-[var(--md-sys-color-primary)]" />}
          title="Portal health"
          hint="Broken ATS links drop companies silently"
        >
          <div data-co-tour="portals-list">
          <PortalsView />
          </div>
        </DossierSection>
      </DossierStack>
    </PageShell>
  );
}
