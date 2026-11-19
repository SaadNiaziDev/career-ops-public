import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, findApplication, readApplications, readReport } from "@/lib/career-ops";
import { db } from "@/lib/db";
import { upsertApplicationAnswersSection } from "@/lib/apply/answers-section.mjs";
import { resolveIndexedCv, resolveTailoredCv } from "@/lib/apply/cv";
import { readSessionSnapshot } from "@/lib/apply/session";
import { detectAtsVendor, isSensitiveField, mergeLiveValues, parseApplicationSnapshot, type ApplicationSnapshot, type SnapshotField, type SnapshotState } from "@/lib/apply/snapshot";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FIELD_TYPES = new Set(["text", "email", "tel", "url", "number", "date", "textarea", "select", "checkbox", "radio", "file"]);

declare global {
  var __coSnapshotWrites: Promise<void> | undefined;
}

function resolveTracker(trackerNum?: string, vacancyUrl?: string) {
  if (trackerNum && /^\d+$/.test(trackerNum)) return findApplication(trackerNum);
  const canonical = vacancyUrl ? normalizeVacancyUrl(vacancyUrl) : null;
  return canonical ? readApplications().find((app) => app.url && normalizeVacancyUrl(app.url) === canonical) ?? null : null;
}

function safeFields(fields: unknown): SnapshotField[] {
  if (!Array.isArray(fields)) return [];
  return fields.slice(0, 250).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const value = item as Partial<SnapshotField>;
    const field: SnapshotField = {
      id: typeof value.id === "string" ? value.id.slice(0, 200) : undefined,
      label: typeof value.label === "string" ? value.label.slice(0, 500) : "Unlabelled field",
      value: typeof value.value === "string" ? value.value.slice(0, 100_000) : "",
      type: FIELD_TYPES.has(value.type ?? "") ? value.type! : "text",
      source: ["profile", "ai", "user", "form"].includes(value.source ?? "") ? value.source! : "user",
    };
    return isSensitiveField(field) ? [] : [field];
  });
}

function cvRecord(company: string, reportNum?: string) {
  const file = resolveIndexedCv(reportNum) ?? resolveTailoredCv(company);
  if (!file) return [];
  const relative = path.relative(careerOpsRoot(), file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return [];
  const content = fs.readFileSync(file);
  return [{ label: "Tailored CV", path: relative, version: path.basename(file), hash: createHash("sha256").update(content).digest("hex") }];
}

/** Store the answers inside the evaluation report (in the database). */
async function writeSnapshot(n: string, snapshot: ApplicationSnapshot): Promise<void> {
  const report = readReport(n);
  if (!report) throw new Error("Application report not found");
  db().prepare("UPDATE reports SET content = ? WHERE n = ?").run(upsertApplicationAnswersSection(report.content, snapshot), Number(n));
}

function serializeWrite(task: () => Promise<void>): Promise<void> {
  const prior = globalThis.__coSnapshotWrites ?? Promise.resolve();
  const current = prior.catch(() => {}).then(task);
  globalThis.__coSnapshotWrites = current;
  return current;
}

export async function GET(req: Request) {
  const trackerNum = new URL(req.url).searchParams.get("tracker") ?? "";
  if (!/^\d+$/.test(trackerNum)) return Response.json({ error: "valid tracker required" }, { status: 400 });
  const report = readReport(trackerNum);
  return Response.json({ snapshot: report ? parseApplicationSnapshot(report.content) : null });
}

export async function POST(req: Request) {
  let body: { trackerNum?: string; sessionId?: string; vacancyUrl?: string; state?: SnapshotState; fields?: unknown };
  try { body = await req.json(); } catch { return Response.json({ error: "bad json" }, { status: 400 }); }
  if (!body.vacancyUrl || !/^https?:\/\//i.test(body.vacancyUrl)) return Response.json({ error: "valid vacancyUrl required" }, { status: 400 });
  if (!body.state || !["draft", "filled", "submitted"].includes(body.state)) return Response.json({ error: "valid state required" }, { status: 400 });

  const app = resolveTracker(body.trackerNum, body.vacancyUrl);
  if (!app) return Response.json({ error: "No evaluated application matches this vacancy" }, { status: 404 });
  const previous = readReport(app.n);
  if (!previous) return Response.json({ error: "Application report not found" }, { status: 404 });
  const existing = previous ? parseApplicationSnapshot(previous.content) : null;
  const now = new Date().toISOString();
  const proxyFields = safeFields(body.fields);
  const live = body.sessionId && body.state !== "draft"
    ? await readSessionSnapshot(body.sessionId).catch(() => ({ fields: [], files: [] }))
    : { fields: [], files: [] };
  const cvFiles = cvRecord(app.company, app.report.match(/\[(\d+)\]/)?.[1] ?? app.n);
  const cvNames = new Set(cvFiles.map((file) => path.basename(file.path)));
  const snapshot: ApplicationSnapshot = {
    state: body.state,
    vacancyUrl: body.vacancyUrl,
    atsVendor: detectAtsVendor(body.vacancyUrl),
    filledAt: body.state === "draft" ? existing?.filledAt : (existing?.filledAt ?? now),
    submittedAt: body.state === "submitted" ? now : undefined,
    fields: safeFields(mergeLiveValues(proxyFields, live.fields)),
    files: [...cvFiles, ...live.files.filter((file) => !cvNames.has(path.basename(file.path)))],
  };

  try {
    // Records answers only. The tracker status changes through /api/status
    // (confirm-gated, stage history, undo) — the client calls it before
    // saving a "submitted" snapshot.
    await serializeWrite(() => writeSnapshot(app.n, snapshot));
    return Response.json({ ok: true, trackerNum: app.n, snapshot });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message.slice(0, 300) : "snapshot write failed" }, { status: 500 });
  }
}
