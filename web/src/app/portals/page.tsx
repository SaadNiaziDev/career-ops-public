"use client";

import { RadarChartOutlined } from "@ant-design/icons";
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
          icon={<RadarChartOutlined className="text-[var(--ant-color-primary)]" />}
          title="Portal health"
          hint="Broken ATS links drop companies silently"
        >
          <PortalsView />
        </DossierSection>
      </DossierStack>
    </PageShell>
  );
}
