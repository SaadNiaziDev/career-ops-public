import { NextResponse } from "next/server";
import { findApplication } from "@/lib/career-ops";
import {
  deleteRound,
  importPrepRounds,
  loadInterviewBundle,
  upsertRound,
  type RoundAudience,
  type RoundOutcome,
  type RoundStatus,
  type RoundType,
} from "@/lib/interview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUND_TYPES = new Set<RoundType>(["screen", "hiring-manager", "technical", "system-design", "behavioral", "onsite", "final"]);
const AUDIENCES = new Set<RoundAudience>(["recruiter-screen", "hiring-manager", "peer-tech", "panel-mixed"]);
const STATUSES = new Set<RoundStatus>(["planned", "scheduled", "done", "cancelled"]);
const OUTCOMES = new Set<RoundOutcome>(["pending", "advanced", "rejected"]);

type Body =
  | { action: "upsert"; trackerNum: string; round: Record<string, unknown> }
  | { action: "delete"; trackerNum: string; roundNo: number }
  | { action: "import"; trackerNum: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const trackerNum = body.trackerNum?.trim();
  if (!trackerNum || !/^\d+$/.test(trackerNum)) {
    return NextResponse.json({ error: "trackerNum required" }, { status: 400 });
  }

  if (!findApplication(trackerNum)) {
    return NextResponse.json({ error: "application not found" }, { status: 404 });
  }

  if (body.action === "import") {
    importPrepRounds(trackerNum);
    const bundle = loadInterviewBundle(trackerNum);
    return NextResponse.json({ rounds: bundle?.rounds ?? [] });
  }

  if (body.action === "delete") {
    const roundNo = Number(body.roundNo);
    if (!Number.isInteger(roundNo) || roundNo < 1) {
      return NextResponse.json({ error: "roundNo required" }, { status: 400 });
    }
    const rounds = deleteRound(trackerNum, roundNo);
    return NextResponse.json({ rounds });
  }

  if (body.action === "upsert") {
    const raw = body.round ?? {};
    const roundNo = Number(raw.roundNo);
    if (!Number.isInteger(roundNo) || roundNo < 1 || roundNo > 50) {
      return NextResponse.json({ error: "round.roundNo required" }, { status: 400 });
    }
    if (!validOptional(raw.type, ROUND_TYPES) || !validOptional(raw.audience, AUDIENCES) || !validOptional(raw.status, STATUSES) || !validOptional(raw.outcome, OUTCOMES)) {
      return NextResponse.json({ error: "invalid round value" }, { status: 400 });
    }
    if (raw.durationMin !== undefined && (typeof raw.durationMin !== "number" || !Number.isInteger(raw.durationMin) || raw.durationMin < 0 || raw.durationMin > 1440)) {
      return NextResponse.json({ error: "durationMin must be 0–1440" }, { status: 400 });
    }
    const rounds = upsertRound(trackerNum, {
      roundNo,
      type: typeof raw.type === "string" ? (raw.type as RoundType) : undefined,
      audience: typeof raw.audience === "string" ? (raw.audience as RoundAudience) : undefined,
      status: typeof raw.status === "string" ? (raw.status as RoundStatus) : undefined,
      scheduledAt: typeof raw.scheduledAt === "string" ? raw.scheduledAt : undefined,
      durationMin: typeof raw.durationMin === "number" ? raw.durationMin : undefined,
      interviewers: typeof raw.interviewers === "string" ? raw.interviewers : undefined,
      format: typeof raw.format === "string" ? raw.format : undefined,
      sessionFile: typeof raw.sessionFile === "string" ? raw.sessionFile : undefined,
      outcome: typeof raw.outcome === "string" ? (raw.outcome as RoundOutcome) : undefined,
      notes: typeof raw.notes === "string" ? raw.notes : undefined,
    });
    return NextResponse.json({ rounds });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

function validOptional<T extends string>(value: unknown, allowed: Set<T>): value is T | undefined {
  return value === undefined || (typeof value === "string" && allowed.has(value as T));
}
