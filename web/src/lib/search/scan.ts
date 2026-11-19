import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "../career-ops-root.ts";
import { db, tx } from "../db.ts";
import { normalizeVacancyUrl } from "../vacancy-identity.ts";
import { ATS_LABELS, BOARD_LABELS, detectAts, fetchAts, fetchBoard, type Ats, type Board, type Hit } from "./sources.ts";

// Free scan: read portals.yml, pull every supported company board + enabled job
// board, keep titles/locations that match the filters, and put new postings in
// the job inbox. Postings seen before (kept, evaluated or dismissed) never return.

type Portals = {
  max_posting_age_days?: number;
  posted_since?: string;
  location_filter?: { always_allow?: string[]; allow?: string[]; block?: string[] };
  content_filter?: { negative?: string[] };
  title_filter?: { positive?: string[]; negative?: string[] };
  tracked_companies?: { name?: string; careers_url?: string; api?: string; enabled?: boolean }[];
  job_boards?: { name?: string; provider?: string; enabled?: boolean }[];
};

export type ScanTarget = { id: string; label: string; source: string; run: () => Promise<Hit[]> };
export type ScanProgress =
  | { type: "start"; total: number }
  | { type: "source"; label: string; source: string; found: number; kept: number; error?: string }
  | { type: "done"; added: number; scanned: number; failed: number };

export function readPortals(root = careerOpsRoot()): Portals {
  try { return (yaml.load(fs.readFileSync(path.join(root, "portals.yml"), "utf8")) as Portals) ?? {}; } catch { return {}; }
}

const GENERIC_REMOTE = /\b(?:fully\s+)?remote(?:[-\s]+(?:first|friendly|ok|work))?\b|\bwork\s+from\s+(?:home|anywhere)\b|\b(?:distributed|worldwide|anywhere|global(?:ly)?|international|flexible)\b/g;
const words = (list?: unknown[]) => (Array.isArray(list) ? list : []).filter((k): k is string => typeof k === "string" && !!k.trim()).map((k) => k.trim().toLowerCase());
const matcher = (kw: string) => (/^[a-z]{2,}$/.test(kw) ? ((s: string) => new RegExp(`\\b${kw}\\b`).test(s)) : (s: string) => s.includes(kw));

/** title / location / age / content filters from portals.yml (same rules as the old scanner). */
export function buildFilter(p: Portals, now = Date.now()) {
  const pos = words(p.title_filter?.positive).map(matcher);
  const neg = words(p.title_filter?.negative).map(matcher);
  const always = words(p.location_filter?.always_allow);
  const allow = words(p.location_filter?.allow);
  const block = words(p.location_filter?.block);
  const contentNeg = words(p.content_filter?.negative);
  const cutoffs: number[] = [];
  if (Number(p.max_posting_age_days) > 0) cutoffs.push(now - Number(p.max_posting_age_days) * 86_400_000);
  if (typeof p.posted_since === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.posted_since)) cutoffs.push(Date.parse(`${p.posted_since}T00:00:00Z`));
  const cutoff = cutoffs.length ? Math.max(...cutoffs) : 0;
  return (h: Hit): boolean => {
    const title = h.title.toLowerCase();
    if (pos.length && !pos.some((m) => m(title))) return false;
    if (neg.some((m) => m(title))) return false;
    const loc = h.location.toLowerCase();
    if (loc.trim() && !always.some((k) => loc.includes(k))) {
      if (block.some((k) => loc.includes(k))) return false;
      if (allow.length) {
        // "Remote" alone is fine; "Remote - US" is remote only inside the US. Strip the
        // generic remote words and require whatever is left to be allowed too.
        const qualifier = loc.replace(GENERIC_REMOTE, " ").replace(/[^a-z]+/g, " ").trim();
        const allowSpecific = allow.filter((k) => k.replace(GENERIC_REMOTE, "").replace(/[^a-z]+/g, "").length > 0);
        if (qualifier && !allowSpecific.some((k) => loc.includes(k))) return false;
        if (!qualifier && !allow.some((k) => loc.includes(k))) return false;
      }
    }
    if (cutoff && h.postedAt && h.postedAt < cutoff) return false;
    if (h.description && contentNeg.some((k) => h.description!.toLowerCase().includes(k))) return false;
    return true;
  };
}

export function scanTargets(p: Portals): ScanTarget[] {
  const targets: ScanTarget[] = [];
  const seen = new Set<string>();
  for (const c of p.tracked_companies ?? []) {
    if (c.enabled === false || !c.name) continue;
    const found = detectAts(c.api ?? "") ?? detectAts(c.careers_url ?? "");
    if (!found) continue;
    const id = `${found.ats}:${found.slug.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    targets.push({ id, label: c.name, source: ATS_LABELS[found.ats as Ats], run: () => fetchAts(found.ats, found.slug, c.name!) });
  }
  for (const b of p.job_boards ?? []) {
    const board = b.provider as Board;
    if (b.enabled === false || !(board in BOARD_LABELS)) continue;
    targets.push({ id: `board:${board}`, label: BOARD_LABELS[board], source: BOARD_LABELS[board], run: () => fetchBoard(board) });
  }
  return targets;
}

/** Save filtered hits that were never seen; returns how many reached the inbox. */
export function saveHits(hits: (Hit & { source: string })[]): number {
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let added = 0;
  tx(() => {
    const d = db();
    const isSeen = d.prepare("SELECT 1 FROM seen WHERE key = ?");
    const markSeen = d.prepare("INSERT OR IGNORE INTO seen (key, url, first_seen, source) VALUES (?, ?, ?, ?)");
    const insert = d.prepare(`INSERT OR IGNORE INTO jobs (key, url, company, role, location, posted_at, seq, created_at, source, kind)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM jobs), ?, ?, 'vacancy')`);
    for (const h of hits) {
      const key = normalizeVacancyUrl(h.url) ?? h.url;
      if (isSeen.get(key)) continue;
      markSeen.run(key, h.url, today, h.source);
      const r = insert.run(key, h.url, h.company || "Unknown company", h.title, h.location || null, h.postedAt ? new Date(h.postedAt).toISOString().slice(0, 10) : null, now, h.source);
      if (Number(r.changes) > 0) added += 1;
    }
  });
  return added;
}

export async function runScan(onProgress: (e: ScanProgress) => void, signal?: AbortSignal): Promise<{ added: number }> {
  const portals = readPortals();
  const keep = buildFilter(portals);
  const targets = scanTargets(portals);
  onProgress({ type: "start", total: targets.length });
  let added = 0;
  let failed = 0;
  let next = 0;
  const worker = async () => {
    while (next < targets.length && !signal?.aborted) {
      const t = targets[next++];
      try {
        const hits = await t.run();
        const kept = hits.filter(keep);
        added += saveHits(kept.map((h) => ({ ...h, source: t.source })));
        onProgress({ type: "source", label: t.label, source: t.source, found: hits.length, kept: kept.length });
      } catch (error) {
        failed += 1;
        onProgress({ type: "source", label: t.label, source: t.source, found: 0, kept: 0, error: error instanceof Error ? error.message : "failed" });
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  onProgress({ type: "done", added, scanned: targets.length, failed });
  return { added };
}
