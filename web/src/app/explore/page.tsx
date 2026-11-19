import { SearchView } from "@/components/search/search-view";
import { getKv } from "@/lib/db";
import { listJobs } from "@/lib/search/jobs";
import { readPortals, scanTargets } from "@/lib/search/scan";

export const dynamic = "force-dynamic";

export default function SearchPage() {
  // Rendered with the data so the page never jumps from "loading" to the list.
  return <SearchView initialJobs={listJobs()} initialLastScan={getKv("search.lastScan")} initialSources={scanTargets(readPortals()).length} />;
}
