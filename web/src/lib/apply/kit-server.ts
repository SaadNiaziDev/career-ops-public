// Server-only Apply-kit assembly: reads the tracker, report snapshot, PDF index,
// cover drafts and profile facts from the user's files. No writes here.
import fs from "node:fs";
import { readActivity } from "@/lib/application-activity-store";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot, findApplication, readApplications, readReport, type Application } from "@/lib/career-ops";
import { listDrafts } from "@/lib/contacts";
import { canonStatus } from "@/lib/format";
import { parseApplicationSnapshot } from "./snapshot";
import { answerStats, coverNeed, scoreOf, usable, type ApplyKit, type KitApp, type ProfileFacts, type QueueItem } from "./kit";

type PdfEntry = { file: string; date?: string };

function pdfIndex(): Map<string, PdfEntry> {
  const out = new Map<string, PdfEntry>();
  let raw = "";
  try {
    raw = fs.readFileSync(path.join(careerOpsRoot(), "data/pdf-index.tsv"), "utf8");
  } catch {
    return out;
  }
  for (const line of raw.split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const [report, pdf, , , date] = line.split("\t");
    if (!/^\d+$/.test(report ?? "") || !pdf) continue;
    const abs = path.resolve(careerOpsRoot(), pdf);
    const rel = path.relative(careerOpsRoot(), abs);
    if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) continue;
    try {
      if (fs.statSync(abs).size < 1_000) continue;
    } catch {
      continue;
    }
    out.set(String(Number.parseInt(report, 10)), { file: path.basename(pdf), date }); // later rows win
  }
  return out;
}

function reportNumOf(app: Application): string {
  return app.report.match(/\[(\d+)\]/)?.[1] ?? app.n;
}

function toKitApp(app: Application): KitApp {
  return {
    n: app.n,
    reportNum: reportNumOf(app),
    company: app.company,
    role: app.role,
    score: scoreOf(app.score),
    status: app.status,
    date: app.date,
    url: app.url,
    location: app.location,
  };
}

function coverDrafts(): Map<string, number> {
  const out = new Map<string, number>();
  for (const d of listDrafts()) if (d.kind === "cover") out.set(String(Number.parseInt(d.trackerNum, 10)), d.mtime);
  return out;
}

function get(doc: unknown, keys: string[]): unknown {
  let v: unknown = doc;
  for (const k of keys) v = v && typeof v === "object" ? (v as Record<string, unknown>)[k] : undefined;
  return v;
}

function first(doc: unknown, paths: string[][]): string | undefined {
  for (const p of paths) {
    const v = usable(get(doc, p));
    if (v) return v;
  }
  return undefined;
}

/** The handful of profile facts application forms ask for. Placeholders ("Not specified") are dropped. */
export function readProfileFacts(): ProfileFacts {
  let doc: unknown = {};
  try {
    doc = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), "config/profile.yml"), "utf8")) ?? {};
  } catch {
    return {};
  }
  const range = first(doc, [["compensation", "target_range"], ["compensation", "minimum"]]);
  const currency = usable(get(doc, ["compensation", "currency"]));
  const period = usable(get(doc, ["compensation", "period"]));
  const salary = range ? [currency && !range.includes(currency) ? currency : "", range, period ? `per ${period}` : ""].filter(Boolean).join(" ") : undefined;
  return {
    name: first(doc, [["candidate", "full_name"]]),
    email: first(doc, [["candidate", "email"]]),
    phone: first(doc, [["candidate", "phone"]]),
    location: first(doc, [["candidate", "location"]]),
    salary,
    visa: first(doc, [["location", "visa_status"], ["candidate", "visa_status"], ["candidate", "work_authorization"]]),
    start: first(doc, [["availability", "start_date"], ["availability", "notice_period"], ["candidate", "notice_period"], ["candidate", "availability"], ["constraints", "notice_period"]]),
    relocation: first(doc, [["location", "relocation"], ["constraints", "relocation"]]),
  };
}

function snapshotFor(n: string) {
  const report = readReport(n);
  return report ? parseApplicationSnapshot(report.content) : null;
}

export function buildKit(n: string): ApplyKit | null {
  const found = findApplication(n);
  if (!found) return null;
  // findApplication doesn't attach the report URL; readApplications does.
  const app = readApplications().find((a) => a.n === found.n) ?? found;
  const kitApp = toKitApp(app);
  const pdf = pdfIndex().get(String(Number.parseInt(kitApp.reportNum, 10)));
  const coverAt = coverDrafts().get(String(Number.parseInt(app.n, 10)));
  const snapshot = snapshotFor(app.n);
  const fields = snapshot?.fields ?? [];
  const stats = answerStats(fields);
  return {
    app: kitApp,
    submissionRecorded: readActivity(careerOpsRoot(), app.n).some((event) => event.kind === "application"),
    cv: pdf
      ? { ready: true, file: pdf.file, date: pdf.date, href: `/api/cv-pdf?report=${encodeURIComponent(kitApp.reportNum)}` }
      : { ready: false },
    cover: { ready: coverAt !== undefined, updatedAt: coverAt, need: coverNeed(fields, fields.length > 0) },
    answers: { state: snapshot?.state ?? null, vacancyUrl: snapshot?.vacancyUrl, fields, ...stats },
    profile: readProfileFacts(),
  };
}

/** Evaluated roles at 4.0+ not yet applied, best first, with kit readiness. */
export function buildQueue(minScore = 4): QueueItem[] {
  const pdfs = pdfIndex();
  const covers = coverDrafts();
  return readApplications()
    .filter((a) => canonStatus(a.status).includes("EVALUATED") && scoreOf(a.score) >= minScore)
    .map((a) => {
      const app = toKitApp(a);
      const snapshot = snapshotFor(a.n);
      const fields = snapshot?.fields ?? [];
      const stats = answerStats(fields);
      return {
        app,
        cvReady: pdfs.has(String(Number.parseInt(app.reportNum, 10))),
        coverReady: covers.has(String(Number.parseInt(a.n, 10))),
        coverNeed: coverNeed(fields, fields.length > 0),
        answersState: snapshot?.state ?? null,
        answered: stats.answered,
        total: stats.total,
      };
    })
    .sort((x, y) => y.app.score - x.app.score || Number(y.app.n) - Number(x.app.n));
}
