import { listOutreach } from "@/lib/outreach";
import { Suspense } from "react";
import { PipelineView } from "@/components/pipeline-view";
import { loadApplicationRecords, summarizeRecord } from "@/lib/application-records";

export const dynamic = "force-dynamic";

export default function PipelinePage() {
  return <Suspense><PipelineView records={loadApplicationRecords().map(summarizeRecord)} unlinkedMessages={listOutreach().filter((item) => !item.trackerNum && item.sentAt && item.status !== "ready")} /></Suspense>;
}
