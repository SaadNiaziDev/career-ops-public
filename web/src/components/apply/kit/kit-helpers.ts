// Small helpers for the Apply kit: CLI and "opened" state, job lookups, snapshot saves.
import type { Job } from "@/components/jobs/job-store";
import type { ApplyKit } from "@/lib/apply/kit";
import type { SnapshotField, SnapshotState } from "@/lib/apply/snapshot";
import type { EditableField } from "../apply-answers";
import { CONFIG_KEY } from "@/lib/cli-config";

const OPENED_KEY = "career-ops:apply-opened";

export function hasCli(): boolean {
  try {
    return !!JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}").cliId;
  } catch {
    return false;
  }
}

export function readOpened(n: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(OPENED_KEY) || "[]") as string[]).includes(n);
  } catch {
    return false;
  }
}

export function rememberOpened(n: string) {
  try {
    const list = (JSON.parse(localStorage.getItem(OPENED_KEY) || "[]") as string[]).filter((x) => x !== n);
    localStorage.setItem(OPENED_KEY, JSON.stringify([n, ...list].slice(0, 50)));
  } catch {
    /* per-viewer convenience only */
  }
}

export function latestJob(jobs: Job[], kind: string, n: string): Job | undefined {
  return jobs.filter((j) => j.kind === kind && j.input === n).sort((a, b) => b.startedAt - a.startedAt)[0];
}

export function isApplied(status: string): boolean {
  return /applied|responded|interview|offer|rejected/i.test(status);
}

export function host(url?: string): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

export function lastStep(job?: Job): string {
  return job?.steps.at(-1)?.label ?? "Working…";
}

export async function postSnapshot(kit: ApplyKit, state: SnapshotState, fields: SnapshotField[]): Promise<boolean> {
  const vacancyUrl = kit.answers.vacancyUrl || kit.app.url;
  if (!vacancyUrl || fields.length === 0) return false;
  const res = await fetch("/api/apply/snapshot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trackerNum: kit.app.n, vacancyUrl, state, fields }),
  }).catch(() => null);
  return !!res?.ok;
}

export function toSnapshotFields(fields: EditableField[]): SnapshotField[] {
  return fields.map(({ id, label, value, type, source }) => ({ id, label, value, type, source }));
}

export function editable(fields: SnapshotField[]): EditableField[] {
  return fields.map((f, i) => ({ ...f, key: f.id ? `${f.id}#${i}` : `field-${i}` }));
}


