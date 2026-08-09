import fs from "node:fs";
import { ExplorerView } from "@/components/explore/explorer-view";
import { seedExploreFilters } from "@/lib/core/portals";
import { readInbox, readApplications, recentScanFinds, careerOpsRoot } from "@/lib/career-ops";
import { DEFAULT_FILTERS } from "@/lib/explore";

// Read live data at request time so a bare checkout (or `next build` with no
// CAREER_OPS_ROOT) never fails — discovery seeds are best-effort.
export const dynamic = "force-dynamic";

export default function ExplorePage() {
  let seed: { filters: typeof DEFAULT_FILTERS; seededFrom: string[] } = { filters: DEFAULT_FILTERS, seededFrom: [] };
  try {
    seed = seedExploreFilters();
  } catch {
    /* bare checkout → defaults */
  }
  let rootExists = false;
  try {
    rootExists = fs.existsSync(careerOpsRoot());
  } catch {
    /* ignore */
  }
  let scans: ReturnType<typeof recentScanFinds> = { finds: [], latestDate: null, totalPending: 0 };
  try {
    scans = recentScanFinds();
  } catch {
    /* no pipeline/scan history yet → section hides itself */
  }

  return (
    <ExplorerView
      seed={seed}
      inboxSnapshot={readInbox()}
      appsSnapshot={readApplications()}
      rootExists={rootExists}
      scans={scans}
    />
  );
}
