import "server-only";

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { careerOpsRoot, findApplication, rootScript } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";
import {
  audienceForType,
  mergeRounds,
  parseAudience,
  parsePrepRounds,
  parseQuestionBank,
  parseRoundType,
  prepSlug,
  roundProgress,
  slugify,
  type InterviewBundle,
  type InterviewRound,
  type RoundAudience,
  type RoundOutcome,
  type RoundStatus,
  type SessionIndex,
  type StatedComp,
} from "@/lib/interview-shared";

export * from "@/lib/interview-shared";

const ROUNDS_HEADER =
  "tracker#\tround_no\ttype\taudience\tstatus\tscheduled_at\tduration_min\tinterviewers\tformat\tsession_file\toutcome\tnotes";

const ROUND_STATUSES = new Set<RoundStatus>(["planned", "scheduled", "done", "cancelled"]);
const ROUND_OUTCOMES = new Set<RoundOutcome>(["pending", "advanced", "rejected"]);
const AUDIENCES = new Set<RoundAudience>([
  "recruiter-screen",
  "hiring-manager",
  "peer-tech",
  "panel-mixed",
]);

function tsvCell(value: string): string {
  return value.replace(/[\t\r\n]+/g, " ").trim();
}

function interviewPrepDir(): string {
  return path.join(careerOpsRoot(), "interview-prep");
}

function roundsPath(): string {
  return path.join(careerOpsRoot(), "data", "interview-rounds.tsv");
}

function sessionsDir(): string {
  return path.join(interviewPrepDir(), "sessions");
}

function readText(rel: string): string | null {
  try {
    return fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8");
  } catch {
    return null;
  }
}

function fileMtime(p: string): number {
  try {
    return fs.statSync(p).mtimeMs;
  } catch {
    return 0;
  }
}

function parseSessionFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].trim();
  }
  return out;
}

function parseSessionFilename(file: string): { companySlug: string; roleSlug: string; round: string; date: string } | null {
  const base = path.basename(file, ".md");
  const dateMatch = base.match(/(\d{4}-\d{2}-\d{2})$/);
  if (!dateMatch) return null;
  const date = dateMatch[1];
  const beforeDate = base.slice(0, -(date.length + 1));
  const roundTypes = ["hiring-manager", "system-design", "screen", "technical", "behavioral", "onsite", "final", "practice"];
  for (const rt of roundTypes.sort((a, b) => b.length - a.length)) {
    if (beforeDate.endsWith(`-${rt}`)) {
      const prefix = beforeDate.slice(0, -(rt.length + 1));
      const parts = prefix.split("-");
      if (parts.length < 2) return null;
      return {
        companySlug: parts.slice(0, -1).join("-"),
        roleSlug: parts[parts.length - 1] ?? "",
        round: rt,
        date,
      };
    }
  }
  return null;
}

export function listSessions(companySlug: string, roleSlug?: string): SessionIndex[] {
  const dir = sessionsDir();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md") && f !== "README.md");
  } catch {
    return [];
  }
  const out: SessionIndex[] = [];
  for (const file of files) {
    if (!file.startsWith(`${companySlug}-`)) continue;
    let content = "";
    try {
      content = fs.readFileSync(path.join(dir, file), "utf8");
    } catch {
      continue;
    }
    const fm = parseSessionFrontmatter(content);
    const parsed = parseSessionFilename(file);
    const resolvedCompany = fm.company ?? parsed?.companySlug ?? "";
    const resolvedRole = fm.role ?? parsed?.roleSlug ?? "";
    if (slugify(resolvedCompany) !== companySlug) continue;
    if (roleSlug && fm.role && slugify(resolvedRole) !== roleSlug) continue;
    const parsedRoundNo = Number.parseInt(fm.round_no ?? "", 10);
    out.push({
      file,
      company: resolvedCompany,
      role: resolvedRole,
      round: fm.round ?? parsed?.round ?? "",
      roundNo: Number.isInteger(parsedRoundNo) && parsedRoundNo > 0 ? parsedRoundNo : null,
      date: fm.date ?? parsed?.date ?? "",
      interviewerRole: fm.interviewer_role ?? "",
      source: fm.source ?? "",
      outcome: ROUND_OUTCOMES.has(fm.outcome as RoundOutcome) ? (fm.outcome as RoundOutcome) : "pending",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

function parseLedgerRow(cols: string[]): InterviewRound | null {
  if (cols.length < 12) return null;
  const roundNo = parseInt(cols[1] ?? "", 10);
  if (!Number.isFinite(roundNo)) return null;
  const type = parseRoundType(cols[2] ?? "");
  const audienceRaw = cols[3] ?? "";
  return {
    roundNo,
    type,
    audience: AUDIENCES.has(audienceRaw as RoundAudience) ? (audienceRaw as RoundAudience) : audienceForType(type),
    status: ROUND_STATUSES.has(cols[4] as RoundStatus) ? (cols[4] as RoundStatus) : "planned",
    scheduledAt: cols[5] ?? "",
    durationMin: parseInt(cols[6] ?? "", 10) || 0,
    interviewers: cols[7] ?? "",
    format: cols[8] ?? "",
    sessionFile: cols[9] ?? "",
    outcome: ROUND_OUTCOMES.has(cols[10] as RoundOutcome) ? (cols[10] as RoundOutcome) : "pending",
    notes: cols[11] ?? "",
    source: "ledger",
  };
}

export function readInterviewRounds(trackerNum: string): InterviewRound[] {
  let raw = "";
  try {
    raw = fs.readFileSync(roundsPath(), "utf8");
  } catch {
    return [];
  }
  const rows: InterviewRound[] = [];
  const lines = raw.split("\n").filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.startsWith("tracker#")) continue;
    const cols = line.split("\t");
    if (cols[0] !== trackerNum) continue;
    const row = parseLedgerRow(cols);
    if (row) rows.push(row);
  }
  return rows.sort((a, b) => a.roundNo - b.roundNo);
}

function writeInterviewRounds(trackerNum: string, forTracker: InterviewRound[]): void {
  let otherTrackerRows: string[] = [];
  try {
    const raw = fs.readFileSync(roundsPath(), "utf8");
    const lines = raw.split("\n").filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i === 0 && line.startsWith("tracker#")) continue;
      const cols = line.split("\t");
      if (cols[0] !== trackerNum) otherTrackerRows.push(line);
    }
  } catch {
    /* fresh */
  }

  const lines = forTracker
    .sort((a, b) => a.roundNo - b.roundNo)
    .map((r) =>
      [
        trackerNum,
        String(r.roundNo),
        r.type,
        r.audience,
        r.status,
        tsvCell(r.scheduledAt),
        String(r.durationMin || ""),
        tsvCell(r.interviewers),
        tsvCell(r.format),
        tsvCell(r.sessionFile),
        r.outcome,
        tsvCell(r.notes),
      ].join("\t"),
    );

  const body = ROUNDS_HEADER + "\n" + [...otherTrackerRows, ...lines].join("\n") + "\n";
  fs.mkdirSync(path.dirname(roundsPath()), { recursive: true });
  atomicWrite(roundsPath(), body);
}

export function resolvePrepFile(trackerNum: string, company: string, role: string): { path: string; content: string } | null {
  const dir = interviewPrepDir();
  const primary = path.join(dir, `${prepSlug(company, role)}.md`);
  if (fs.existsSync(primary)) {
    return { path: primary, content: fs.readFileSync(primary, "utf8") };
  }

  let files: string[] = [];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "story-bank.md" && f !== "question-bank.md" && !f.endsWith("-redflags.md"));
  } catch {
    return null;
  }

  const reportNeedle = `#${trackerNum}`;
  const reportFileNeedle = `reports/${trackerNum.padStart(3, "0")}`;
  const reportFileNeedle2 = `reports/${trackerNum}-`;

  for (const f of files) {
    try {
      const content = fs.readFileSync(path.join(dir, f), "utf8");
      if (
        content.includes(reportNeedle) ||
        content.includes(reportFileNeedle) ||
        content.includes(reportFileNeedle2) ||
        content.includes(`**Report:** [${trackerNum}]`) ||
        content.includes(`**Report:** ${trackerNum}`)
      ) {
        return { path: path.join(dir, f), content };
      }
    } catch {
      continue;
    }
  }

  const companySlug = slugify(company);
  for (const f of files) {
    if (f.startsWith(companySlug)) {
      try {
        return { path: path.join(dir, f), content: fs.readFileSync(path.join(dir, f), "utf8") };
      } catch {
        continue;
      }
    }
  }

  return null;
}

function roundsFromSessions(sessions: SessionIndex[], knownRounds: InterviewRound[]): InterviewRound[] {
  const used = new Set<number>();
  let nextRoundNo = Math.max(0, ...knownRounds.map((round) => round.roundNo)) + 1;

  return [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((session) => {
      const type = parseRoundType(String(session.round));
      const scheduledMatch = knownRounds.find(
        (round) => !used.has(round.roundNo) && round.type === type && round.scheduledAt.slice(0, 10) === session.date,
      );
      const typeMatch = knownRounds.find((round) => !used.has(round.roundNo) && round.type === type);
      const roundNo = session.roundNo ?? scheduledMatch?.roundNo ?? typeMatch?.roundNo ?? nextRoundNo++;
      used.add(roundNo);
      return {
        roundNo,
        type,
        audience: audienceForType(type),
        status: "done" as const,
        scheduledAt: session.date,
        durationMin: 0,
        interviewers: session.interviewerRole,
        format: String(session.round),
        sessionFile: session.file,
        outcome: session.outcome,
        notes: "",
        source: "session" as const,
      };
    });
}

export function readStatedComp(trackerNum: string): StatedComp[] {
  try {
    const out = execFileSync("node", [rootScript("salary-gap"), "--stated-for", trackerNum], {
      cwd: careerOpsRoot(),
      timeout: 8000,
      encoding: "utf8",
    });
    const parsed = JSON.parse(out) as { stated?: Array<Record<string, string>> };
    const list = Array.isArray(parsed.stated) ? parsed.stated : [];
    return list.map((row) => ({
      date: row.date ?? "",
      amount: row.amount ?? "",
      currency: row.currency ?? "",
      round: row.round ?? "",
      interviewer: row.interviewer ?? "",
      note: row.note ?? "",
    }));
  } catch {
    return [];
  }
}

export function loadInterviewBundle(trackerNum: string): InterviewBundle | null {
  const app = findApplication(trackerNum);
  if (!app) return null;

  const company = app.company;
  const role = app.role;
  const prep = resolvePrepFile(trackerNum, company, role);
  const prepContent = prep?.content ?? null;
  const prepPath = prep?.path ?? null;

  const qbContent = readText("interview-prep/question-bank.md");
  const storyContent = readText("interview-prep/story-bank.md");
  const redflagsPath = path.join(interviewPrepDir(), `${slugify(company)}-redflags.md`);
  let redflagsContent: string | null = null;
  try {
    if (fs.existsSync(redflagsPath)) redflagsContent = fs.readFileSync(redflagsPath, "utf8");
  } catch {
    redflagsContent = null;
  }

  const sessions = listSessions(slugify(company), slugify(role));
  const prepRounds = prepContent ? parsePrepRounds(prepContent) : [];
  const ledgerRounds = readInterviewRounds(trackerNum);
  const knownRounds = mergeRounds(prepRounds, ledgerRounds, []);
  const completedSessions = sessions.filter((session) => session.source === "debrief" || session.source === "manual");
  const sessionRounds = roundsFromSessions(completedSessions, knownRounds);
  const rounds = mergeRounds(prepRounds, ledgerRounds, sessionRounds);
  const questions = qbContent ? parseQuestionBank(qbContent, company, role) : [];
  const statedComp = readStatedComp(trackerNum);

  return {
    trackerNum,
    company,
    role,
    prepPath: prepPath ? path.relative(careerOpsRoot(), prepPath) : null,
    prepContent,
    prepMtime: prepPath ? fileMtime(prepPath) : 0,
    questionBankPath: qbContent ? "interview-prep/question-bank.md" : null,
    questionBankContent: qbContent,
    storyBankContent: storyContent,
    redflagsContent,
    rounds,
    questions,
    sessions,
    statedComp,
  };
}

export type RoundPatch = Partial<Omit<InterviewRound, "source">> & { roundNo: number };

export function upsertRound(trackerNum: string, patch: RoundPatch): InterviewRound[] {
  const current = readInterviewRounds(trackerNum);
  const idx = current.findIndex((r) => r.roundNo === patch.roundNo);
  const base: InterviewRound =
    idx >= 0
      ? { ...current[idx], ...patch, source: "ledger" }
      : {
          roundNo: patch.roundNo,
          type: patch.type ?? "screen",
          audience: patch.audience ?? "recruiter-screen",
          status: patch.status ?? "planned",
          scheduledAt: patch.scheduledAt ?? "",
          durationMin: patch.durationMin ?? 0,
          interviewers: patch.interviewers ?? "",
          format: patch.format ?? "",
          sessionFile: patch.sessionFile ?? "",
          outcome: patch.outcome ?? "pending",
          notes: patch.notes ?? "",
          source: "ledger",
        };

  const next =
    idx >= 0 ? current.map((r, i) => (i === idx ? base : r)) : [...current, base].sort((a, b) => a.roundNo - b.roundNo);
  writeInterviewRounds(trackerNum, next);
  return next;
}

export function deleteRound(trackerNum: string, roundNo: number): InterviewRound[] {
  const next = readInterviewRounds(trackerNum).filter((r) => r.roundNo !== roundNo);
  writeInterviewRounds(trackerNum, next);
  return next;
}

export function importPrepRounds(trackerNum: string): InterviewRound[] {
  const app = findApplication(trackerNum);
  if (!app) return [];
  const prep = resolvePrepFile(trackerNum, app.company, app.role);
  if (!prep) return readInterviewRounds(trackerNum);
  const prepRounds = parsePrepRounds(prep.content);
  const current = readInterviewRounds(trackerNum);
  const byNo = new Map(current.map((r) => [r.roundNo, r]));
  for (const r of prepRounds) {
    if (!byNo.has(r.roundNo)) byNo.set(r.roundNo, { ...r, status: "planned", source: "ledger" });
  }
  const merged = [...byNo.values()].sort((a, b) => a.roundNo - b.roundNo);
  writeInterviewRounds(trackerNum, merged);
  return merged;
}

export function readInterviewProgressMap(trackerNums: string[]): Map<string, { done: number; total: number }> {
  const out = new Map<string, { done: number; total: number }>();
  for (const n of trackerNums) {
    const bundle = loadInterviewBundle(n);
    if (!bundle) continue;
    const { done, total } = roundProgress(bundle.rounds);
    if (total > 0) out.set(n, { done, total });
  }
  return out;
}
