import fs from "node:fs";
import path from "node:path";
import { db } from "@/lib/db";
import { careerOpsRoot } from "@/lib/career-ops-root";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";
import { offerDeadlineFromNotes } from "@/lib/offer-deadline";
import { onboardingVerificationPending } from "@/lib/onboarding/readiness-state";

export { careerOpsRoot, engineScript } from "@/lib/career-ops-root";

/** Rows are soft-deleted in SQLite, so deletion is always available. */
export function trackerCanDelete(): boolean {
  return true;
}

function read(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

export type InboxJob = {
  url: string;
  company: string;
  role: string;
  location?: string;
  compensation?: string;
  done: boolean;
  postedAt?: string;
  /** `fit: NN` annotation the scanner appends (heuristic 0-100), when present. */
  fitScore?: number;
};

type JobRow = { url: string; company: string; role: string; location: string | null; compensation: string | null; posted_at: string | null; fit_score: number | null; done: number };

/** The job inbox: postings found by search or added by hand, oldest first. */
export function readInbox(): InboxJob[] {
  const rows = db().prepare("SELECT url, company, role, location, compensation, posted_at, fit_score, done FROM jobs WHERE removed = 0 ORDER BY seq, created_at").all() as JobRow[];
  return rows.map((r) => ({
    url: r.url,
    company: r.company,
    role: r.role,
    location: r.location ?? undefined,
    compensation: r.compensation ?? undefined,
    postedAt: r.posted_at ?? undefined,
    fitScore: r.fit_score ?? undefined,
    done: r.done === 1,
  }));
}

/** url key → first date the posting was seen by a scan. */
export function readScanDates(): Map<string, string> {
  const rows = db().prepare("SELECT key, first_seen FROM seen").all() as { key: string; first_seen: string }[];
  return new Map(rows.map((r) => [r.key, r.first_seen]));
}

export type Application = {
  n: string;
  date: string;
  company: string;
  /** Intermediary channel (#1596): agency/recruiter firm, "—" for direct, "" when the tracker has no Via column. */
  via: string;
  role: string;
  url?: string;
  location?: string;
  score: string;
  status: string;
  pdf: string;
  report: string;
  notes: string;
  nextInterviewAt?: string;
  offerDeadline?: string;
};

export type ApplicationStageEvent = { n: string; from: string; to: string; at: string };

export function readApplicationStageHistory(): ApplicationStageEvent[] {
  const rows = db().prepare("SELECT n, at, data FROM events WHERE kind = 'status' ORDER BY at").all() as { n: number; at: string; data: string }[];
  return rows.map((r) => {
    const d = JSON.parse(r.data) as { from?: string; to?: string };
    return { n: String(r.n), from: d.from ?? "", to: d.to ?? "", at: r.at };
  });
}

function reportsWithVerifiedPdf(): Set<string> {
  const ready = new Set<string>();
  const manifest = read("data/pdf-index.tsv");
  if (!manifest) return ready;
  for (const line of manifest.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [report, pdf, , , , template, , , sourceReport, renderer] = line.split("\t");
    if (!/^\d+$/.test(report) || !pdf || !template || !sourceReport || !renderer) continue;
    const abs = path.resolve(careerOpsRoot(), pdf);
    const rel = path.relative(careerOpsRoot(), abs);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    let handle: number | undefined;
    try {
      const header = Buffer.alloc(5);
      handle = fs.openSync(abs, "r");
      fs.readSync(handle, header, 0, 5, 0);
      if (fs.statSync(abs).size >= 1_000 && header.toString("ascii") === "%PDF-") ready.add(String(Number.parseInt(report, 10)));
    } catch { /* stale manifest entry */ }
    finally { if (handle !== undefined) fs.closeSync(handle); }
  }
  return ready;
}

type AppRow = { n: number; date: string; company: string; via: string; role: string; location: string | null; score: string; status: string; pdf: string; report: string; notes: string; r_url: string | null; r_location: string | null };

/** All tracked applications, in tracker-number order. */
export function readApplications(): Application[] {
  const rows = db().prepare(`SELECT a.*, r.url AS r_url, r.location AS r_location FROM applications a
    LEFT JOIN reports r ON r.n = a.n
    WHERE a.deleted = 0 ORDER BY a.n`).all() as AppRow[];
  const pdfReady = reportsWithVerifiedPdf();
  return rows.map((row) => {
    const reportNum = row.report.match(/\[(\d+)\]/)?.[1];
    return {
      n: String(row.n),
      date: row.date,
      company: row.company,
      via: row.via,
      role: row.role,
      score: row.score,
      status: row.status,
      report: row.report,
      notes: row.notes,
      pdf: reportNum && pdfReady.has(String(Number.parseInt(reportNum, 10))) ? "✅" : row.pdf,
      url: row.r_url ?? undefined,
      location: row.location || row.r_location || undefined,
      offerDeadline: offerDeadlineFromNotes(row.notes),
    };
  });
}

/**
 * Server-side lifecycle of the user's setup — mirrors the prerequisite list that
 * doctor.mjs uses (cv.md, config/profile.yml, modes/_profile.md, portals.yml), by
 * plain file-stat (no subprocess). Drives the home branch: first-run (no CV) →
 * the CV takeover; in-between (CV but no profile) → gentle nudges; established.
 */
export type LifecyclePhase = "first-run" | "in-between" | "established";
/**
 * Server-side lifecycle, mirroring the core doctor.mjs prerequisite list with the
 * SAME existsSync semantics (the SSOT the OnboardingBanner already reads via
 * /api/doctor). The 4 user-layer prereqs: cv.md, config/profile.yml,
 * modes/_profile.md, portals.yml.
 *   - first-run  → no cv.md yet: the onboarding wizard (CLI + CV dropzone).
 *   - in-between → has cv but setup incomplete: dashboard + the nudge banner.
 *   - established → all 4 prereqs present.
 * onboardingNeeded mirrors doctor.mjs: true if ANY prereq is missing → show banner.
 */
/** Auto-copy user-layer templates (portals.yml, modes/_profile.md, …) — same rules as doctor.mjs --json. */
export function ensureOnboardingTemplates(): string[] {
  const root = careerOpsRoot();
  const autoCopied: string[] = [];
  const templates = [
    { target: "modes/_profile.md", template: "_profile.template.md" },
    { target: "modes/_custom.md", template: "_custom.template.md" },
    { target: "portals.yml", template: "portals.example.yml" },
    { target: "config/profile.yml", template: "profile.example.yml" },
  ];
  for (const { target, template } of templates) {
    const targetPath = path.join(root, ...target.split("/"));
    const templatePath = path.join(process.cwd(), "engine", "templates", template);
    if (!fs.existsSync(targetPath) && fs.existsSync(templatePath)) {
      try {
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(templatePath, targetPath);
        autoCopied.push(target);
      } catch {
        /* read-only fs — doctor /api will retry */
      }
    }
  }
  return autoCopied;
}

export function doctorState(): {
  phase: LifecyclePhase;
  onboardingNeeded: boolean;
  missing: string[];
  hasCv: boolean;
  hasData: boolean;
  verificationPending: boolean;
} {
  const has = (rel: string) => {
    try {
      return fs.existsSync(path.join(careerOpsRoot(), rel));
    } catch {
      return false;
    }
  };
  const prereqs: [string, string][] = [
    ["cv.md", "cv.md"],
    ["config/profile.yml", "config/profile.yml"],
    ["modes/_profile.md", "modes/_profile.md"],
    ["portals.yml", "portals.yml"],
  ];
  const missing = prereqs.filter(([rel]) => !has(rel)).map(([, label]) => label);
  const hasCv = has("cv.md");
  const hasData = readApplications().length > 0 || readInbox().some((j) => !j.done);
  const verificationPending = onboardingVerificationPending(careerOpsRoot());
  if (verificationPending) missing.push("setup verification");
  const onboardingNeeded = missing.length > 0;
  const phase: LifecyclePhase = !hasCv || verificationPending ? "first-run" : onboardingNeeded ? "in-between" : "established";
  return { phase, onboardingNeeded, missing, hasCv, hasData, verificationPending };
}

export type PipelineSummary = {
  root: string;
  rootExists: boolean;
  inbox: InboxJob[];
  applications: Application[];
};

export function pipelineSummary(): PipelineSummary {
  const root = careerOpsRoot();
  const scanDates = readScanDates();
  const applications = readApplications();
  const evaluatedUrls = new Set(applications.map((a) => (a.url ? normalizeVacancyUrl(a.url) : null)).filter(Boolean));
  return {
    root,
    rootExists: fs.existsSync(root),
    inbox: readInbox()
      .filter((j) => !evaluatedUrls.has(normalizeVacancyUrl(j.url) ?? ""))
      .map((j) => ({ ...j, postedAt: scanDates.get(normalizeVacancyUrl(j.url) ?? j.url) })),
    applications,
  };
}

export type ReportData = { content: string; file: string };

export function readReport(n: string): ReportData | null {
  const target = Number.parseInt(n, 10);
  if (Number.isNaN(target)) return null;
  const row = db().prepare("SELECT file, content FROM reports WHERE n = ?").get(target) as { file: string; content: string } | undefined;
  return row ? { content: row.content, file: row.file } : null;
}

export function findApplication(n: string): Application | null {
  return readApplications().find((a) => a.n === n) ?? null;
}

/** The CANONICAL user-customization file the CLI/TUI reads. Durable facts the
 *  web assistant learns go HERE (single source of truth) inside a managed marker
 *  block — so the CLI sees them too. No web-only memory store (that would drift). */
export function profilePath(): string {
  return path.join(careerOpsRoot(), "modes", "_profile.md");
}
