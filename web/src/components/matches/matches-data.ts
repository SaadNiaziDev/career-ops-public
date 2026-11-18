import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, pipelineSummary, readInbox, readReport, readScanDates } from "@/lib/career-ops";
import { canonStatus, parseMachineSummary, scoreNum } from "@/lib/format";
import { listOutreach } from "@/lib/outreach";
import { seedExploreFilters } from "@/lib/core/portals";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";
import type { MatchBucket, MatchItem, MatchOutreach, MatchesSearch } from "./matches-shared";

/** Server-only loader for /matches. Reads the same user-layer files as Pipeline and Outreach; writes nothing. */

const SENT_STATES = ["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "REJECTED"];
const SKIPPED_STATES = ["SKIP", "DISCARDED"];

function shortLocation(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const clean = raw.replace(/[`*]/g, "").replace(/\s+/g, " ").trim();
  if (!clean || clean === "—" || clean === "-") return undefined;
  const first = clean.split(/(?<=\.)\s/)[0] ?? clean;
  return first.length > 96 ? `${first.slice(0, 93).trimEnd()}…` : first;
}

function shortComp(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const clean = raw.replace(/\s+/g, " ").trim();
  if (!clean || /^(null|none|n\/a|unknown|not (stated|disclosed|advertised)\.?)$/i.test(clean)) return undefined;
  return clean.length > 110 ? `${clean.slice(0, 107).trimEnd()}…` : clean;
}

function strings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.trim().length > 0).map((s) => s.trim()) : [];
}

function lastScan(): { at: string | null; added: number | null } {
  try {
    const tsv = fs.readFileSync(path.join(careerOpsRoot(), "data/scan-runs.tsv"), "utf8");
    const lines = tsv.trim().split("\n");
    const header = lines[0]?.split("\t") ?? [];
    const addedCol = header.indexOf("new_added");
    for (let i = lines.length - 1; i > 0; i--) {
      const cols = lines[i].split("\t");
      if (!cols[0] || Number.isNaN(Date.parse(cols[0]))) continue;
      const added = addedCol >= 0 ? Number.parseInt(cols[addedCol] ?? "", 10) : NaN;
      return { at: cols[0], added: Number.isFinite(added) ? added : null };
    }
  } catch {
    /* no scan yet */
  }
  return { at: null, added: null };
}

export function loadMatches(): { items: MatchItem[]; search: MatchesSearch } {
  const { inbox, applications } = pipelineSummary();
  const outreach = listOutreach();
  const scanDates = readScanDates();
  // pipelineSummary() swaps postedAt for first-seen; keep the posting's own date too.
  const postedByUrl = new Map(readInbox().map((j) => [normalizeVacancyUrl(j.url) ?? j.url, j.postedAt]));

  const outreachFor = (n?: string, url?: string): MatchOutreach | undefined => {
    const key = url ? normalizeVacancyUrl(url) ?? url : null;
    const rec = outreach.find((r) => r.status !== "dismissed" && ((n && r.trackerNum === n) || (key && r.jobUrl && (normalizeVacancyUrl(r.jobUrl) ?? r.jobUrl) === key)));
    return rec ? { id: rec.id, status: rec.status, contactName: rec.contact?.name ?? "", contactTitle: rec.contact?.title ?? "", updatedAt: rec.updatedAt } : undefined;
  };

  const items: MatchItem[] = [];
  const seen = new Set<string>();

  for (const a of applications) {
    const canon = canonStatus(a.status);
    const o = outreachFor(a.n, a.url);
    const contacted = o && (o.status === "sent" || o.status === "replied");
    let bucket: MatchBucket;
    if (SENT_STATES.some((s) => canon.includes(s)) || contacted) bucket = "sent";
    else if (SKIPPED_STATES.some((s) => canon.includes(s))) bucket = "skipped";
    else if (canon.includes("EVALUATED")) bucket = "new";
    else continue;

    const report = readReport(a.n);
    const ms = report ? parseMachineSummary(report.content) : null;
    const score = scoreNum(a.score);
    if (a.url) seen.add(normalizeVacancyUrl(a.url) ?? a.url);
    items.push({
      id: `t:${a.n}`,
      kind: "evaluated",
      n: a.n,
      url: a.url,
      company: a.company,
      role: a.role,
      location: shortLocation(a.location),
      comp: shortComp(ms?.advertised_comp),
      seenAt: /^\d{4}-\d{2}-\d{2}$/.test(a.date) ? a.date : undefined,
      score: Number.isFinite(score) ? score : undefined,
      status: a.status,
      bucket,
      strengths: strings(ms?.top_strengths).slice(0, 3),
      gaps: strings(ms?.soft_gaps).slice(0, 3),
      hardStops: strings(ms?.hard_stops),
      decision: ms?.final_decision || undefined,
      nextAction: ms?.next_action || undefined,
      archetype: ms?.archetype || undefined,
      legitimacy: ms?.legitimacy_tier || undefined,
      notes: a.notes && a.notes !== "—" ? a.notes : undefined,
      pdfReady: (a.pdf ?? "").includes("✅"),
      outreach: o,
    });
  }

  for (const j of inbox) {
    if (j.done) continue;
    const key = normalizeVacancyUrl(j.url) ?? j.url;
    if (seen.has(key)) continue;
    seen.add(key);
    const o = outreachFor(undefined, j.url);
    items.push({
      id: `u:${j.url}`,
      kind: "inbox",
      url: j.url,
      company: j.company,
      role: j.role,
      location: shortLocation(j.location),
      comp: shortComp(j.compensation),
      postedAt: postedByUrl.get(key),
      seenAt: scanDates.get(key),
      fit: j.fitScore,
      bucket: o && (o.status === "sent" || o.status === "replied") ? "sent" : "new",
      strengths: [],
      gaps: [],
      hardStops: [],
      pdfReady: false,
      outreach: o,
    });
  }

  const { filters } = seedExploreFilters();
  const scan = lastScan();
  return {
    items,
    search: { titles: filters.positive, locations: filters.allow, lastScanAt: scan.at, lastScanAdded: scan.added },
  };
}
