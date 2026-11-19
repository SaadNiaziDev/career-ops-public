import type { OutreachRecord } from "@/lib/outreach-shared";

/** Apply one change to a saved outreach thread; returns the updated record, or null on failure. */
export async function patchItem(body: Record<string, unknown>): Promise<OutreachRecord | null> {
  const res = await fetch("/api/outreach", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return null;
  return ((await res.json()) as { item: OutreachRecord }).item;
}

/** "today", "yesterday", a weekday this week, else a short date. */
export function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  const today = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === -1) return "yesterday";
  if (diff === 1) return "tomorrow";
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
