/** Product list defaults. Analytics charts remain ranked by their measured quantity. */
export const DEFAULT_SORT_POLICY = {
  pipelineInbox: "newest discovered",
  pipelineAll: "newest tracked",
  pipelineEvaluated: "highest score",
  pipelineApplied: "newest tracked",
  pipelineResponded: "newest tracked",
  pipelineInterview: "next scheduled event",
  pipelineOffer: "decision deadline",
  pipelineClosed: "newest tracked",
  contacts: "newest added",
  exploreResults: "match quality then freshness",
  todayFollowups: "urgency then due date",
  todayDecisions: "highest score",
  todayInterviewsAndOffers: "next event or deadline",
  todayFreshMatches: "newest discovered",
  workerHistory: "newest started",
  analyticsBreakdowns: "measured count descending",
} as const;

export function readSortPreference<T extends string>(key: string, allowed: readonly T[], fallback: T, storage?: Pick<Storage, "getItem">): T {
  try {
    const saved = (storage ?? globalThis.localStorage).getItem(key) as T | null;
    return saved && allowed.includes(saved) ? saved : fallback;
  } catch { return fallback; }
}

export function writeSortPreference(key: string, value: string, storage?: Pick<Storage, "setItem">): void {
  try { (storage ?? globalThis.localStorage).setItem(key, value); } catch { /* preference unavailable */ }
}

/** Date-only ordering deliberately ignores timezone-less times. Unknown dates sort last. */
export function knownDay(raw?: string | null): string | null {
  const match = raw?.trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? `${match[1]}-${match[2]}-${match[3]}`
    : null;
}

export function newestFirst(a?: string | null, b?: string | null): number {
  const left = knownDay(a);
  const right = knownDay(b);
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  return right.localeCompare(left);
}

export function soonestFirst(a?: string | null, b?: string | null): number {
  const left = knownDay(a);
  const right = knownDay(b);
  if (!left) return right ? 1 : 0;
  if (!right) return -1;
  return left.localeCompare(right);
}

export function scheduledInterviewDates(tsv: string): Map<string, string> {
  const scheduled = new Map<string, string>();
  for (const line of tsv.split("\n")) {
    const [trackerNum, , , , status, scheduledAt] = line.split("\t");
    const day = knownDay(scheduledAt);
    if (status !== "scheduled" || !day || !/^\d+$/.test(trackerNum ?? "")) continue;
    const current = scheduled.get(trackerNum);
    if (!current || soonestFirst(day, current) < 0) scheduled.set(trackerNum, day);
  }
  return scheduled;
}

export function offerDeadlineFromNotes(notes: string): string | undefined {
  const date = notes.match(/\b(?:decision|offer)\s+deadline\s*[:=-]\s*(\d{4}-\d{2}-\d{2})\b/i)?.[1];
  return knownDay(date) ?? undefined;
}

const text = (a?: string, b?: string) => (a ?? "").localeCompare(b ?? "", undefined, { sensitivity: "base" });
const score = (value?: string | number) => {
  const n = Number.parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : -Infinity;
};
const compareScore = (a?: string | number, b?: string | number, ascending = false) => {
  const left = score(a);
  const right = score(b);
  if (left === -Infinity) return right === -Infinity ? 0 : 1;
  if (right === -Infinity) return -1;
  return ascending ? left - right : right - left;
};

export type SortableApplication = {
  n: string;
  date: string;
  company: string;
  role: string;
  status: string;
  score: string;
  nextInterviewAt?: string;
  offerDeadline?: string;
};
export type ApplicationOrder = "default" | "date-desc" | "date-asc" | "score-desc" | "score-asc" | "company-asc" | "company-desc" | "role-asc" | "role-desc" | "status-asc" | "status-desc";

export function applicationOrderFromParams(params: URLSearchParams): ApplicationOrder {
  const key = params.get("sort");
  if (!key || !["date", "score", "company", "role", "status"].includes(key)) return "default";
  return `${key}-${params.get("dir") === "1" ? "asc" : "desc"}` as ApplicationOrder;
}

export function defaultApplicationOrder(stage: string): string {
  if (stage === "EVALUATED") return "Highest score";
  if (stage === "INTERVIEW") return "Next interview";
  if (stage === "OFFER") return "Decision deadline";
  return "Newest first";
}

export function sortApplications<T extends SortableApplication>(rows: T[], stage: string, order: ApplicationOrder = "default"): T[] {
  return [...rows].sort((a, b) => {
    let compared = 0;
    if (order === "default") {
      if (stage === "EVALUATED") compared = compareScore(a.score, b.score);
      else if (stage === "INTERVIEW") compared = soonestFirst(a.nextInterviewAt, b.nextInterviewAt);
      else if (stage === "OFFER") compared = soonestFirst(a.offerDeadline, b.offerDeadline);
      else compared = newestFirst(a.date, b.date);
    } else if (order === "date-desc") compared = newestFirst(a.date, b.date);
    else if (order === "date-asc") compared = soonestFirst(a.date, b.date);
    else if (order === "score-desc") compared = compareScore(a.score, b.score);
    else if (order === "score-asc") compared = compareScore(a.score, b.score, true);
    else if (order === "company-asc") compared = text(a.company, b.company);
    else if (order === "company-desc") compared = text(b.company, a.company);
    else if (order === "role-asc") compared = text(a.role, b.role);
    else if (order === "role-desc") compared = text(b.role, a.role);
    else if (order === "status-asc") compared = text(a.status, b.status);
    else if (order === "status-desc") compared = text(b.status, a.status);
    return compared || newestFirst(a.date, b.date) || text(a.company, b.company) || text(a.role, b.role) || text(a.n, b.n);
  });
}

export type SortableContact = { date: string; lastTouch?: string; company: string; name: string; trackerNum: string; email?: string };
export type ContactOrder = "newest" | "oldest" | "company";
export function sortContacts<T extends SortableContact>(rows: T[], order: ContactOrder = "newest"): T[] {
  return [...rows].sort((a, b) => {
    const compared = order === "company" ? text(a.company, b.company)
      : order === "oldest" ? soonestFirst(a.date, b.date) : newestFirst(a.date, b.date);
    return compared || newestFirst(a.lastTouch, b.lastTouch) || text(a.company, b.company) || text(a.name, b.name) || text(a.trackerNum, b.trackerNum) || text(a.email, b.email);
  });
}

export type SortableOffer = { url: string; company: string; title: string; postedAt?: string; fitScore?: number };
export type OfferOrder = "fit" | "fresh" | "company";
export function sortOffers<T extends SortableOffer>(rows: T[], order: OfferOrder = "fit"): T[] {
  return [...rows].sort((a, b) => {
    const compared = order === "company" ? text(a.company, b.company)
      : order === "fresh" ? newestFirst(a.postedAt, b.postedAt)
        : (b.fitScore ?? -Infinity) - (a.fitScore ?? -Infinity);
    return compared || newestFirst(a.postedAt, b.postedAt) || text(a.company, b.company) || text(a.title, b.title) || text(a.url, b.url);
  });
}

export type SortableInbox = { url: string; company: string; role: string; postedAt?: string; fitScore?: number };
export type InboxOrder = "newest" | "fit" | "company";
export function sortInbox<T extends SortableInbox>(rows: T[], order: InboxOrder = "newest"): T[] {
  return [...rows].sort((a, b) => {
    const compared = order === "company" ? text(a.company, b.company)
      : order === "fit" ? (b.fitScore ?? -Infinity) - (a.fitScore ?? -Infinity)
        : newestFirst(a.postedAt, b.postedAt);
    return compared || newestFirst(a.postedAt, b.postedAt) || text(a.company, b.company) || text(a.role, b.role) || text(a.url, b.url);
  });
}

export type SortableFollowup = { urgency?: string; nextFollowupDate?: string; company?: string; num?: number };
export function sortFollowups<T extends SortableFollowup>(rows: T[]): T[] {
  const rank = (entry: T) => entry.urgency === "urgent" ? 0 : entry.urgency === "overdue" ? 1 : entry.urgency === "waiting" ? 2 : 3;
  return [...rows].sort((a, b) => rank(a) - rank(b) || soonestFirst(a.nextFollowupDate, b.nextFollowupDate)
    || text(a.company, b.company) || (a.num ?? 0) - (b.num ?? 0));
}

export function sortTodayFocus<T extends SortableApplication>(rows: T[]): T[] {
  const event = (row: T) => row.status.toUpperCase().includes("OFFER") ? row.offerDeadline : row.nextInterviewAt;
  return [...rows].sort((a, b) => soonestFirst(event(a), event(b)) || newestFirst(a.date, b.date)
    || text(a.company, b.company) || text(a.n, b.n));
}
