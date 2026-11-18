import { db, tx } from "@/lib/db";
import { normalizeVacancyUrl } from "@/lib/vacancy-identity";
import type { DiscoveredOffer } from "@/lib/explore";

/**
 * "Add to pipeline": save chosen search results to the job inbox and mark them
 * seen so later searches skip them. Re-adding a removed posting restores it.
 */
export type AddResult = { added: number; error?: string };

export async function addOffersToPipeline(offers: DiscoveredOffer[]): Promise<AddResult> {
  const clean = offers.filter((o) => o && typeof o.url === "string" && /^https?:\/\//i.test(o.url) && (o.company || o.title));
  if (clean.length === 0) return { added: 0 };
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  let added = 0;
  tx(() => {
    const d = db();
    const seq = (d.prepare("SELECT COALESCE(MAX(seq), 0) AS m FROM jobs").get() as { m: number }).m;
    const insert = d.prepare(`INSERT INTO jobs (key, url, company, role, location, posted_at, fit_score, seq, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET removed = 0 WHERE jobs.removed = 1`);
    const seen = d.prepare("INSERT OR IGNORE INTO seen (key, url, first_seen, source) VALUES (?, ?, ?, ?)");
    for (const [i, o] of clean.entries()) {
      const key = normalizeVacancyUrl(o.url) ?? o.url;
      const result = insert.run(key, o.url, o.company || "Unknown", o.title || "Untitled role", o.location || null, o.postedAt || null, typeof o.fitScore === "number" ? o.fitScore : null, seq + i + 1, now);
      if (Number(result.changes) > 0) added += 1;
      seen.run(key, o.url, today, "added");
    }
  });
  return { added };
}
