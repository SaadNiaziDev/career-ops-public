import { TrackView } from "@/components/track/track-view";
import { loadApplicationRecords, summarizeRecords } from "@/lib/application-records";

export const dynamic = "force-dynamic";

export default function TrackPage() {
  return <TrackView records={summarizeRecords(loadApplicationRecords())} />;
}
