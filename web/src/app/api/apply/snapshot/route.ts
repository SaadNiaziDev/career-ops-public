import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { careerOpsRoot, findApplication, findReportFile, readApplications, readReport, rootScript } from "@/lib/career-ops";
import { resolveTailoredCv } from "@/lib/apply/cv";
import { readSessionSnapshot } from "@/lib/apply/session";
import { detectAtsVendor, isSensitiveField, mergeLiveValues, parseApplicationSnapshot, type ApplicationSnapshot, type SnapshotField, type SnapshotState } from "@/lib/apply/snapshot";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const run = promisify(execFile);
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

function cvRecord(company: string) {
  const file = resolveTailoredCv(company);
  if (!file) return [];
  const relative = path.relative(careerOpsRoot(), file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return [];
  const content = fs.readFileSync(file);
  return [{ label: "Tailored CV", path: relative, version: path.basename(file), hash: createHash("sha256").update(content).digest("hex") }];
}

async function writeSnapshot(reportFile: string, snapshot: ApplicationSnapshot): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn("node", [rootScript("application-answers"), "--report", reportFile, "--input", "-", "--state", snapshot.state], {
      cwd: careerOpsRoot(), stdio: ["pipe", "ignore", "pipe"],
    });
    let error = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { error = (error + chunk).slice(-2000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(error.trim() || `snapshot writer exited ${code}`)));
    child.stdin.end(JSON.stringify(snapshot));
  });
}

function serializeWrite(task: () => Promise<void>): Promise<void> {
  const prior = globalThis.__coSnapshotWrites ?? Promise.resolve();
  const current = prior.catch(() => {}).then(task);
  globalThis.__coSnapshotWrites = current;
  return current;
}

async function markApplied(trackerNum: string): Promise<void> {
  await run("node", [rootScript("set-status"), trackerNum, "Applied", "--json"], {
    cwd: careerOpsRoot(), maxBuffer: 512 * 1024,
  });
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
  const reportFile = findReportFile(app.n);
  if (!reportFile) return Response.json({ error: "Application report not found" }, { status: 404 });

  const previous = readReport(app.n);
  const existing = previous ? parseApplicationSnapshot(previous.content) : null;
  const now = new Date().toISOString();
  const proxyFields = safeFields(body.fields);
  const live = body.sessionId && body.state !== "draft"
    ? await readSessionSnapshot(body.sessionId).catch(() => ({ fields: [], files: [] }))
    : { fields: [], files: [] };
  const cvFiles = cvRecord(app.company);
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
    await serializeWrite(async () => {
      await writeSnapshot(reportFile, snapshot);
      if (body.state === "submitted") await markApplied(app.n);
    });
    return Response.json({ ok: true, trackerNum: app.n, snapshot });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message.slice(0, 300) : "snapshot write failed" }, { status: 500 });
  }
}
