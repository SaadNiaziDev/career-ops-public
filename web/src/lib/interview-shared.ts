export type RoundType =
  | "screen"
  | "hiring-manager"
  | "technical"
  | "system-design"
  | "behavioral"
  | "onsite"
  | "final";

export type RoundAudience = "recruiter-screen" | "hiring-manager" | "peer-tech" | "panel-mixed";

export type RoundStatus = "planned" | "scheduled" | "done" | "cancelled";

export type RoundOutcome = "pending" | "advanced" | "rejected";

export type QuestionProvenance =
  | "asked"
  | "sourced"
  | "pattern"
  | "inferred"
  | "variant"
  | "unknown";

export type InterviewRound = {
  roundNo: number;
  type: RoundType;
  audience: RoundAudience;
  status: RoundStatus;
  scheduledAt: string;
  durationMin: number;
  interviewers: string;
  format: string;
  sessionFile: string;
  outcome: RoundOutcome;
  notes: string;
  source: "session" | "ledger" | "prep";
};

export type QuestionBankRow = {
  num: number;
  question: string;
  roundLabel: string;
  audience: RoundAudience | "";
  status: "strong" | "solid" | "gap" | "none";
  source: string;
  sourceTier: QuestionProvenance;
  lastAsked: string;
};

export type SessionIndex = {
  file: string;
  trackerNum: string | null;
  company: string;
  role: string;
  round: RoundType | string;
  roundNo: number | null;
  date: string;
  interviewerRole: string;
  source: string;
  outcome: RoundOutcome;
};

export type StatedComp = {
  date: string;
  amount: string;
  currency: string;
  round: string;
  interviewer: string;
  note: string;
};

export type InterviewBundle = {
  trackerNum: string;
  company: string;
  role: string;
  prepPath: string | null;
  prepContent: string | null;
  prepMtime: number;
  questionBankPath: string | null;
  questionBankContent: string | null;
  storyBankContent: string | null;
  redflagsContent: string | null;
  rounds: InterviewRound[];
  questions: QuestionBankRow[];
  sessions: SessionIndex[];
  statedComp: StatedComp[];
};

const ROUND_TYPES = new Set<RoundType>([
  "screen",
  "hiring-manager",
  "technical",
  "system-design",
  "behavioral",
  "onsite",
  "final",
]);

const AUDIENCES = new Set<RoundAudience>([
  "recruiter-screen",
  "hiring-manager",
  "peer-tech",
  "panel-mixed",
]);

export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function prepSlug(company: string, role: string): string {
  return `${slugify(company)}-${slugify(role)}`;
}

export function parseRoundType(raw: string): RoundType {
  const v = raw.trim().toLowerCase() as RoundType;
  if (ROUND_TYPES.has(v)) return v;
  if (/recruiter|screen|hr/i.test(raw)) return "screen";
  if (/hiring.?manager|hm/i.test(raw)) return "hiring-manager";
  if (/system.?design|design/i.test(raw)) return "system-design";
  if (/behavior/i.test(raw)) return "behavioral";
  if (/onsite|panel|loop/i.test(raw)) return "onsite";
  if (/final|founder/i.test(raw)) return "final";
  return "technical";
}

export function parseAudience(raw: string): RoundAudience {
  const v = raw.trim().toLowerCase() as RoundAudience;
  if (AUDIENCES.has(v)) return v;
  if (/recruiter|hr|screen/i.test(raw)) return "recruiter-screen";
  if (/hiring.?manager|hm/i.test(raw)) return "hiring-manager";
  if (/panel|mixed|onsite/i.test(raw)) return "panel-mixed";
  return "peer-tech";
}

export function audienceForType(type: RoundType): RoundAudience {
  switch (type) {
    case "screen":
      return "recruiter-screen";
    case "hiring-manager":
      return "hiring-manager";
    case "onsite":
    case "final":
      return "panel-mixed";
    case "behavioral":
      return "hiring-manager";
    default:
      return "peer-tech";
  }
}

function parseStatusEmoji(raw: string): QuestionBankRow["status"] {
  if (raw.includes("✅")) return "strong";
  if (raw.includes("🟡")) return "solid";
  if (raw.includes("🔴")) return "gap";
  return "none";
}

function classifySource(source: string): QuestionProvenance {
  const s = source.trim();
  if (!s || s === "—" || s === "-") return "unknown";
  if (/asked\s*[—-]\s*round/i.test(s)) return "asked";
  if (/pattern-variant/i.test(s)) return "variant";
  if (/pattern:/i.test(s)) return "pattern";
  if (/inferred from jd/i.test(s)) return "inferred";
  if (/\[(glassdoor|blind|leetcode|reddit)/i.test(s) || /https?:\/\//i.test(s)) return "sourced";
  if (/inferred/i.test(s)) return "inferred";
  return "unknown";
}

function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return [];
  const parts = trimmed.split("|").map((c) => c.trim());
  if (parts.length < 3) return [];
  return parts.slice(1, -1);
}

export function parseQuestionBank(md: string, company: string, role: string): QuestionBankRow[] {
  const heading = `## ${company} — ${role}`;
  const altHeading = `## ${company} - ${role}`;
  const idx = md.indexOf(heading) >= 0 ? md.indexOf(heading) : md.indexOf(altHeading);
  if (idx < 0) return [];
  const section = md.slice(idx);
  const lines = section.split("\n");
  const rows: QuestionBankRow[] = [];
  let inTable = false;

  for (const line of lines) {
    if (line.startsWith("## ") && !line.startsWith(heading) && !line.startsWith(altHeading)) break;
    if (line.includes("| # |") || line.includes("|#|")) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (/^\|\s*[-:]+\s*\|/.test(line)) continue;
    const cols = splitTableRow(line);
    if (cols.length < 6) {
      if (cols.length === 0) inTable = false;
      continue;
    }
    const num = parseInt(cols[0] ?? "", 10);
    if (!Number.isFinite(num)) continue;
    rows.push({
      num,
      question: cols[1] ?? "",
      roundLabel: cols[2] ?? "",
      audience: AUDIENCES.has(cols[3] as RoundAudience) ? (cols[3] as RoundAudience) : "",
      status: parseStatusEmoji(cols[4] ?? ""),
      source: cols[5] ?? "",
      sourceTier: classifySource(cols[5] ?? ""),
      lastAsked: (cols[6] ?? "") === "—" ? "" : (cols[6] ?? ""),
    });
  }
  return rows;
}

export function parsePrepRounds(prepContent: string): InterviewRound[] {
  const rounds: InterviewRound[] = [];
  const audienceMap = new Map<number, RoundAudience>();
  const audienceSection = prepContent.match(/## Audience Map([\s\S]*?)(?=\n## |\n### Round|$)/i);
  if (audienceSection?.[1]) {
    for (const line of audienceSection[1].split("\n")) {
      const m = line.match(/\*\*Round\s+(\d+)\*\*[^→]*→\s*`([^`]+)`/i);
      if (m) audienceMap.set(parseInt(m[1], 10), parseAudience(m[2]));
    }
  }

  const roundHeading = /^#{2,3}\s+Round\s+(\d+):\s*([^—\n]+)(?:\s*—\s*audience:\s*`([^`]+)`)?/gim;
  let match: RegExpExecArray | null;
  while ((match = roundHeading.exec(prepContent)) !== null) {
    const roundNo = parseInt(match[1], 10);
    const typeLabel = match[2]?.trim() ?? "";
    const audienceRaw = match[3]?.trim() ?? audienceMap.get(roundNo) ?? "";
    const type = parseRoundType(typeLabel);
    const audience = audienceRaw ? parseAudience(audienceRaw) : audienceMap.get(roundNo) ?? audienceForType(type);
    rounds.push({
      roundNo,
      type,
      audience,
      status: "planned",
      scheduledAt: "",
      durationMin: 0,
      interviewers: "",
      format: typeLabel,
      sessionFile: "",
      outcome: "pending",
      notes: "",
      source: "prep",
    });
  }

  if (rounds.length === 0 && audienceMap.size > 0) {
    for (const [roundNo, audience] of [...audienceMap.entries()].sort((a, b) => a[0] - b[0])) {
      const type =
        audience === "recruiter-screen"
          ? "screen"
          : audience === "hiring-manager"
            ? "hiring-manager"
            : audience === "panel-mixed"
              ? "onsite"
              : "technical";
      rounds.push({
        roundNo,
        type,
        audience,
        status: "planned",
        scheduledAt: "",
        durationMin: 0,
        interviewers: "",
        format: "",
        sessionFile: "",
        outcome: "pending",
        notes: "",
        source: "prep",
      });
    }
  }

  return rounds.sort((a, b) => a.roundNo - b.roundNo);
}

export function extractRoundSection(prepContent: string, roundNo: number): string {
  const re = new RegExp(
    `#{2,3}\\s+Round\\s+${roundNo}:[\\s\\S]*?(?=\\n#{2,3}\\s+Round\\s+\\d+:|\\n## (?!Round )|$)`,
    "i",
  );
  return prepContent.match(re)?.[0]?.trim() ?? "";
}

export function extractAudiencePack(prepContent: string, audience: RoundAudience): string {
  const label =
    audience === "recruiter-screen"
      ? "recruiter-screen"
      : audience === "hiring-manager"
        ? "hiring-manager"
        : audience === "panel-mixed"
          ? "panel-mixed"
          : "peer-tech";
  const re = new RegExp(
    `### Audience:\\s*\`${label}\`[\\s\\S]*?(?=\\n### Audience:|\\n## [^#]|$)`,
    "i",
  );
  return prepContent.match(re)?.[0]?.trim() ?? "";
}

export function mergeRounds(
  prepRounds: InterviewRound[],
  ledgerRounds: InterviewRound[],
  sessionRounds: InterviewRound[],
): InterviewRound[] {
  const byNo = new Map<number, InterviewRound>();
  for (const r of prepRounds) byNo.set(r.roundNo, { ...r });
  for (const r of ledgerRounds) {
    const prev = byNo.get(r.roundNo);
    byNo.set(r.roundNo, prev ? { ...prev, ...r, source: "ledger" } : { ...r });
  }
  for (const r of sessionRounds) {
    const existing = byNo.get(r.roundNo) ?? [...byNo.values()].find((x) => x.sessionFile === r.sessionFile);
    if (existing) {
      byNo.set(existing.roundNo, {
        ...existing,
        type: r.type,
        audience: r.audience,
        status: "done",
        scheduledAt: existing.scheduledAt || r.scheduledAt,
        interviewers: existing.interviewers || r.interviewers,
        format: existing.format || r.format,
        sessionFile: r.sessionFile,
        outcome: r.outcome === "pending" ? existing.outcome : r.outcome,
        source: "session",
      });
    } else {
      const roundNo = r.roundNo || byNo.size + 1;
      byNo.set(roundNo, { ...r, roundNo });
    }
  }
  return [...byNo.values()].sort((a, b) => a.roundNo - b.roundNo);
}

export function questionsForRound(questions: QuestionBankRow[], round: InterviewRound): QuestionBankRow[] {
  const roundNo = round.roundNo;
  const roundPattern = new RegExp(`\\bround\\s*${roundNo}\\b`, "i");
  return questions.filter((q) => {
    const label = q.roundLabel.toLowerCase();
    if (roundPattern.test(label)) return true;
    if (round.audience && q.audience === round.audience) return true;
    if (round.type && label.includes(round.type.replace("-", " "))) return true;
    return false;
  });
}

export function roundProgress(rounds: InterviewRound[]): { done: number; total: number; next: InterviewRound | null } {
  const total = rounds.length;
  const done = rounds.filter((r) => r.status === "done").length;
  const next =
    rounds.find((r) => r.status === "scheduled") ??
    rounds.find((r) => r.status === "planned") ??
    null;
  return { done, total, next };
}

export const ROUND_TYPE_OPTIONS: { value: RoundType; label: string }[] = [
  { value: "screen", label: "Recruiter screen" },
  { value: "hiring-manager", label: "Hiring manager" },
  { value: "technical", label: "Technical" },
  { value: "system-design", label: "System design" },
  { value: "behavioral", label: "Behavioral" },
  { value: "onsite", label: "Onsite / panel" },
  { value: "final", label: "Final" },
];

export const AUDIENCE_OPTIONS: { value: RoundAudience; label: string }[] = [
  { value: "recruiter-screen", label: "Recruiter screen" },
  { value: "hiring-manager", label: "Hiring manager" },
  { value: "peer-tech", label: "Peer / technical" },
  { value: "panel-mixed", label: "Panel / mixed" },
];

export const PROVENANCE_LABEL: Record<QuestionProvenance, string> = {
  asked: "Asked in real interview",
  sourced: "Reported online",
  pattern: "Pattern from similar company",
  inferred: "Inferred from JD",
  variant: "Drill variant",
  unknown: "Unknown",
};

export const PROV_ORDER: QuestionProvenance[] = ["asked", "sourced", "pattern", "inferred", "variant", "unknown"];
