import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export type PortalsKeywords = {
  positive: string[];
  negative: string[];
  configured: boolean;
};

function listFrom(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter(Boolean);
}

export function readPortalsKeywords(): PortalsKeywords {
  const file = path.join(careerOpsRoot(), "portals.yml");
  try {
    const doc = yaml.load(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const tf = (doc?.title_filter ?? {}) as Record<string, unknown>;
    return {
      positive: listFrom(tf.positive),
      negative: listFrom(tf.negative),
      configured: true,
    };
  } catch {
    return { positive: [], negative: [], configured: false };
  }
}

/** Append keywords to title_filter.positive (dedup, case-insensitive). */
export function appendPortalsKeywords(keywords: string[]): { added: string[]; positive: string[] } {
  const root = careerOpsRoot();
  const file = path.join(root, "portals.yml");
  let doc: Record<string, unknown> = {};
  try {
    doc = (yaml.load(fs.readFileSync(file, "utf8")) as Record<string, unknown>) || {};
  } catch {
    try {
      doc = (yaml.load(fs.readFileSync(path.join(root, "templates", "portals.example.yml"), "utf8")) as Record<string, unknown>) || {};
    } catch {
      doc = {};
    }
  }

  const tf = doc.title_filter && typeof doc.title_filter === "object" ? { ...(doc.title_filter as object) } : {};
  const existing = listFrom((tf as Record<string, unknown>).positive);
  const lower = new Set(existing.map((k) => k.toLowerCase()));
  const added: string[] = [];
  for (const kw of keywords.map((k) => k.trim()).filter(Boolean)) {
    if (lower.has(kw.toLowerCase())) continue;
    existing.push(kw);
    lower.add(kw.toLowerCase());
    added.push(kw);
  }
  (tf as Record<string, unknown>).positive = existing;
  doc.title_filter = tf;
  atomicWriteWithBackup(file, yaml.dump(doc, { lineWidth: 100, noRefs: true }));
  return { added, positive: existing };
}
