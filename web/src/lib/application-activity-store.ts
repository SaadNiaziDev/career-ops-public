import { createHash } from "node:crypto";
import { db } from "./db.ts";
import type { ApplicationActivity } from "./application-activity-shared";

export function activityIdFor(sourceKey: string): string {
  const hash = createHash("sha256").update(sourceKey).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const ACTIVITY_KINDS = ["application", "email", "followup", "note"];

/** Timeline entries the user recorded for one application (status changes excluded), newest first. */
export function readActivity(_root: string, n: string): ApplicationActivity[] {
  if (!/^[1-9]\d{0,5}$/.test(n)) throw new Error("Invalid application number.");
  const rows = db().prepare(`SELECT data FROM events WHERE n = ? AND kind IN (${ACTIVITY_KINDS.map(() => "?").join(",")}) ORDER BY at DESC, id`)
    .all(Number(n), ...ACTIVITY_KINDS) as { data: string }[];
  return rows.map((r) => JSON.parse(r.data) as ApplicationActivity);
}

/** Immutable: retrying the same id returns the stored record; reusing it for different content fails. */
export function saveActivity(_root: string, event: ApplicationActivity): ApplicationActivity {
  if (!/^[a-f0-9-]{36}$/i.test(event.id)) throw new Error("Invalid activity identifier.");
  if (!/^[1-9]\d{0,5}$/.test(event.n)) throw new Error("Invalid application number.");
  const existing = db().prepare("SELECT data FROM events WHERE id = ?").get(event.id) as { data: string } | undefined;
  if (existing) {
    const prev = JSON.parse(existing.data) as ApplicationActivity;
    const { at: _a, ...oldFields } = prev;
    const { at: _b, ...newFields } = event;
    if (JSON.stringify(oldFields) !== JSON.stringify(newFields)) throw new Error("This activity identifier was already used for a different record.");
    return prev;
  }
  db().prepare("INSERT INTO events (id, n, kind, at, data) VALUES (?, ?, ?, ?, ?)").run(event.id, Number(event.n), event.kind, event.at, JSON.stringify(event));
  return event;
}
