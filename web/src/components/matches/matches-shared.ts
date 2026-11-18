/** Pure Matches types + helpers, shared by the server loader and the client view. */

export type MatchBucket = "new" | "skipped" | "sent";

export type MatchOutreach = {
  id: string;
  status: "ready" | "sent" | "replied" | "dismissed";
  contactName: string;
  contactTitle: string;
  updatedAt: string;
};

export type MatchItem = {
  /** Stable key: `t:{n}` for tracker rows, `u:{url}` for inbox postings. */
  id: string;
  kind: "inbox" | "evaluated";
  n?: string;
  url?: string;
  company: string;
  role: string;
  location?: string;
  comp?: string;
  /** Date the posting went up (ISO day), when known. */
  postedAt?: string;
  /** Date career-ops first saw it (scan history) or evaluated it (tracker date). */
  seenAt?: string;
  /** Scanner heuristic fit, 0-100 (inbox only). */
  fit?: number;
  /** Evaluation score, 0-5 (tracker only). */
  score?: number;
  status?: string;
  /** Server-side bucket. Inbox items may still be moved to "skipped" client-side (shared hidden list). */
  bucket: MatchBucket;
  strengths: string[];
  gaps: string[];
  hardStops: string[];
  decision?: string;
  nextAction?: string;
  archetype?: string;
  legitimacy?: string;
  notes?: string;
  pdfReady: boolean;
  outreach?: MatchOutreach;
};

export type MatchesSearch = {
  titles: string[];
  locations: string[];
  lastScanAt: string | null;
  lastScanAdded: number | null;
};

/** One comparable rank on a 0-100 scale: evaluation score (x20) or scanner fit. */
export function rankOf(item: MatchItem): number {
  if (typeof item.score === "number" && Number.isFinite(item.score)) return item.score * 20;
  if (typeof item.fit === "number" && Number.isFinite(item.fit)) return item.fit;
  return -1;
}

function freshness(item: MatchItem): string {
  return item.postedAt || item.seenAt || "";
}

/** Best rank first, then freshest. */
export function sortMatches(items: MatchItem[]): MatchItem[] {
  return [...items].sort((a, b) => rankOf(b) - rankOf(a) || freshness(b).localeCompare(freshness(a)) || a.company.localeCompare(b.company));
}

/** Most recent first (used for Skipped / Sent history tabs). */
export function sortRecent(items: MatchItem[]): MatchItem[] {
  return [...items].sort((a, b) => freshness(b).localeCompare(freshness(a)) || (Number(b.n ?? 0) - Number(a.n ?? 0)));
}

export function daysAgo(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function ageLabel(days: number | null): string {
  if (days == null) return "";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 60) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "never";
  const mins = Math.max(0, Math.round((now - t) / 60_000));
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}

/** Posting-age phrase with the most honest source available. */
export function ageText(item: MatchItem, now = Date.now()): string {
  if (item.postedAt) return `Posted ${ageLabel(daysAgo(item.postedAt, now))}`;
  if (item.kind === "evaluated" && item.seenAt) return `Evaluated ${ageLabel(daysAgo(item.seenAt, now))}`;
  if (item.seenAt) return `Found ${ageLabel(daysAgo(item.seenAt, now))}`;
  return "";
}

export function scoreTone(item: MatchItem): "good" | "warn" | "bad" | "muted" {
  if (typeof item.score === "number") return item.score >= 4.2 ? "good" : item.score >= 3.8 ? "warn" : item.score >= 3 ? "muted" : "bad";
  if (typeof item.fit === "number") return item.fit >= 75 ? "good" : item.fit >= 60 ? "warn" : "muted";
  return "muted";
}

export function scoreLabel(item: MatchItem): string | null {
  if (typeof item.score === "number") return `${item.score.toFixed(1)}/5`;
  if (typeof item.fit === "number") return `Fit ${Math.round(item.fit)}`;
  return null;
}
