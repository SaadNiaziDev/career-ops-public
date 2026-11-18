import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { MatchesSkeleton } from "@/components/matches/matches-view";

export default function MatchesLoading() {
  return (
    <PageShell width="wide">
      <DossierPageHeader title="Matches" description="New roles, best first. Decide each one in a keystroke: skip it, evaluate it, write to the person hiring, or apply." />
      <MatchesSkeleton />
    </PageShell>
  );
}
