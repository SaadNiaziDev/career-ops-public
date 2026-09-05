import { Suspense } from "react";
import { pipelineSummary } from "@/lib/career-ops";
import { readInterviewProgressMap } from "@/lib/interview";
import { canonStatus } from "@/lib/format";
import { PipelineView } from "@/components/pipeline-view";

export const dynamic = "force-dynamic"; // always read fresh local files

export default function PipelinePage() {
  const { inbox, applications } = pipelineSummary();
  const interviewIds = applications
    .filter((a) => {
      const c = canonStatus(a.status);
      return c.includes("INTERVIEW") || c.includes("OFFER");
    })
    .map((a) => a.n);
  const interviewProgress = Object.fromEntries(readInterviewProgressMap(interviewIds));
  return (
    <Suspense>
      <PipelineView applications={applications} inbox={inbox} interviewProgress={interviewProgress} />
    </Suspense>
  );
}
