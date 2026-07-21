import { PortalsView } from "@/components/portals-view";
import { TitlesBroadening } from "@/components/portals/titles-broadening";
import { PortalsHero } from "@/components/portals/portals-hero";
import { DossierSection } from "@/components/dossier/dossier-section";
import { PageShell } from "@/components/dossier/page-shell";
import { Radar } from "lucide-react";

export const dynamic = "force-dynamic";

export default function PortalsPage() {
  return (
    <PageShell width="4xl">
      <PortalsHero />
      <TitlesBroadening />
      <DossierSection
        icon={<Radar className="size-4 text-brand" />}
        title="Portal health"
        hint="Broken ATS links drop companies silently"
        className="mt-6"
      >
        <PortalsView />
      </DossierSection>
    </PageShell>
  );
}
