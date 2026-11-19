import { db, tx } from "../db.ts";
import { normalizeVacancyUrl } from "../vacancy-identity.ts";

export type JobStatus = "new" | "evaluated" | "dismissed";
export type SearchJob = {
  key: string;
  url: string;
  company: string;
  role: string;
  location: string;
  source: string;
  kind: "vacancy" | "hiring-signal";
  why: string;
  postedAt: string;
  foundAt: string;
  status: JobStatus;
  n?: string;
  score?: string;
  appStatus?: string;
};

type Row = { key: string; url: string; company: string; role: string; location: string | null; source: string | null; kind: string | null; why: string | null; posted_at: string | null; created_at: string | null; done: number; removed: number };

/** Every job in the inbox with its evaluation (if any), newest first. */
export function listJobs(): SearchJob[] {
  const d = db();
  const evals = new Map<string, { n: number; score: string; status: string }>();
  for (const r of d.prepare(`SELECT r.url, a.n, a.score, a.status FROM reports r JOIN applications a ON a.n = r.n AND a.deleted = 0 WHERE r.url IS NOT NULL`).all() as { url: string; n: number; score: string; status: string }[]) {
    const key = normalizeVacancyUrl(r.url) ?? r.url;
    evals.set(key, r);
  }
  const rows = d.prepare("SELECT key, url, company, role, location, source, kind, why, posted_at, created_at, done, removed FROM jobs ORDER BY COALESCE(created_at, '') DESC, seq DESC").all() as Row[];
  return rows.map((r) => {
    const ev = evals.get(r.key);
    return {
      key: r.key, url: r.url, company: r.company, role: r.role, location: r.location ?? "",
      source: r.source ?? "Earlier scan", kind: r.kind === "hiring-signal" ? "hiring-signal" : "vacancy", why: r.why ?? "",
      postedAt: r.posted_at ?? "", foundAt: (r.created_at ?? "").slice(0, 10),
      status: r.removed ? "dismissed" : ev || r.done ? "evaluated" : "new",
      ...(ev ? { n: String(ev.n), score: ev.score, appStatus: ev.status } : {}),
    };
  });
}

export function setDismissed(key: string, dismissed: boolean): boolean {
  return Number(db().prepare("UPDATE jobs SET removed = ? WHERE key = ?").run(dismissed ? 1 : 0, key).changes) > 0;
}

export type NewJob = { url: string; company: string; role: string; location?: string; source: string; kind?: string; why?: string; postedAt?: string };

/** Add one job (AI search result or pasted link); returns false if it was already known. */
export function addJob(j: NewJob): boolean {
  const key = normalizeVacancyUrl(j.url) ?? j.url;
  const now = new Date().toISOString();
  return tx(() => {
    const d = db();
    d.prepare("INSERT OR IGNORE INTO seen (key, url, first_seen, source) VALUES (?, ?, ?, ?)").run(key, j.url, now.slice(0, 10), j.source);
    const r = d.prepare(`INSERT OR IGNORE INTO jobs (key, url, company, role, location, posted_at, seq, created_at, source, kind, why)
      VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(seq), 0) + 1 FROM jobs), ?, ?, ?, ?)`)
      .run(key, j.url, j.company || "Unknown company", j.role || "Untitled role", j.location || null, j.postedAt || null, now, j.source, j.kind === "hiring-signal" ? "hiring-signal" : "vacancy", j.why || null);
    return Number(r.changes) > 0;
  });
}
