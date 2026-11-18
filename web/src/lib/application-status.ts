import { db, tx } from "@/lib/db";
import { scoreNum } from "@/lib/format";

export class StatusUpdateError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

const STATES: Record<string, string[]> = {
  Evaluated: ["evaluada"],
  Applied: ["aplicado", "enviada", "aplicada", "sent"],
  Responded: ["respondido"],
  Interview: ["entrevista"],
  Offer: ["oferta"],
  Rejected: ["rechazado", "rechazada"],
  Discarded: ["descartado", "descartada", "cerrada", "cancelada"],
  SKIP: ["no_aplicar", "no aplicar", "monitor"],
  Hired: ["contratado", "contratada", "accepted", "accept"],
};

/** Canonical tracker state for a label or alias (case-insensitive), else null. */
export function canonicalState(raw: string): string | null {
  const value = raw.replace(/\*/g, "").trim().toLowerCase();
  for (const [label, aliases] of Object.entries(STATES)) {
    if (label.toLowerCase() === value || aliases.includes(value)) return label;
  }
  return null;
}

export async function updateApplicationStatus(body: { n: string | number; status: string; overrideReason?: string; confirmedSubmission?: boolean }) {
  const n = Number(body.n);
  const canonical = canonicalState(String(body.status ?? ""));
  if (!canonical) throw new StatusUpdateError("invalid status", 400);
  const row = db().prepare("SELECT status, score, notes FROM applications WHERE n = ? AND deleted = 0").get(n) as { status: string; score: string; notes: string } | undefined;
  if (!row) throw new StatusUpdateError("row not found", 404);
  if (canonical === "Applied" && body.confirmedSubmission !== true) {
    throw new StatusUpdateError("Confirm that you submitted the application before marking it Applied.", 409);
  }
  const score = scoreNum(String(row.score));
  const overrideReason = typeof body.overrideReason === "string" ? body.overrideReason.trim().replace(/[\r\n]+/g, " ").slice(0, 500) : "";
  const lowScore = canonical === "Applied" && Number.isFinite(score) && score < 4;
  if (lowScore && !overrideReason) {
    throw new StatusUpdateError("This role scored below 4.0; provide an override reason to mark it Applied.", 409);
  }
  const previous = canonicalState(row.status) ?? row.status;
  const now = new Date().toISOString();
  const notes = lowScore ? [row.notes, `Below-4.0 apply override: ${overrideReason}`].filter(Boolean).join(" · ") : row.notes;
  tx(() => {
    db().prepare("UPDATE applications SET status = ?, notes = ?, updated_at = ? WHERE n = ?").run(canonical, notes, now, n);
    if (previous !== canonical) {
      db().prepare("INSERT OR IGNORE INTO events (id, n, kind, at, data) VALUES (?, ?, 'status', ?, ?)")
        .run(`stage:${n}:${now}:${canonical}`, n, now, JSON.stringify({ from: previous, to: canonical }));
    }
  });
  return { ok: true, status: canonical, historyRecorded: true };
}
