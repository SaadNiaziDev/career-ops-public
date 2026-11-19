import { PipelineView } from "@/components/pipeline-view";
import { loadApplicationRecords, summarizeRecords } from "@/lib/application-records";

export const dynamic = "force-dynamic";

export default function TrackPage() {
  return <PipelineView records={summarizeRecords(loadApplicationRecords())} />;
}
