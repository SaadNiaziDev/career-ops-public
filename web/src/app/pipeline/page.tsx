import { buildApplicationFlow } from "@/lib/application-flow";
import { readApplicationStageHistory } from "@/lib/career-ops";
import { TrackView } from "@/components/track/track-view";
import { loadApplicationRecords, summarizeRecords } from "@/lib/application-records";

export const dynamic = "force-dynamic";

export default function TrackPage() {
  const records = loadApplicationRecords();
  const flow = buildApplicationFlow(records.map(r => r.app), readApplicationStageHistory(), records.flatMap(r => r.events.filter(e => e.kind === "application").map(e => ({ n: r.app.n, at: e.at }))));
  return <TrackView records={summarizeRecords(records)} flow={flow} />;
}
