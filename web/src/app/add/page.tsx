import { JobLinkHub } from "@/components/job-link-hub";
import { DossierHero } from "@/components/dossier/dossier-hero";
import { PageShell } from "@/components/dossier/page-shell";

export const dynamic = "force-dynamic";

export default function AddJobPage() {
  return (
    <PageShell width="narrow">
      <DossierHero
        eyebrow="Single posting"
        title="Add a job link"
        description="Paste any careers or ATS URL — evaluate it against your CV, queue it in your inbox, or hunt for similar roles on the open web."
      />
      <JobLinkHub origin="/add" />
    </PageShell>
  );
}
