import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { DEFAULT_WEIGHTS, normalizeWeights, WEIGHT_KEYS, type WeightKey, type Weights } from "@/lib/weights";

// Filesystem half of the ranking weights (portals.yml → `ranking.weights`).
// The scanner and Explore both rank with these; until now nothing in the UI
// could change them, so two screens explained arithmetic nobody could reach
// (blueprint S13 · gap 4). Pure helpers live in lib/weights.ts.

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function portalsFile(): string {
  return path.join(careerOpsRoot(), "portals.yml");
}

function loadDoc(): Record<string, unknown> {
  const root = careerOpsRoot();
  for (const file of [portalsFile(), path.join(root, "templates", "portals.example.yml")]) {
    try {
      const doc = yaml.load(fs.readFileSync(file, "utf8"));
      if (isObj(doc)) return doc;
    } catch {
      // fall through to the next candidate
    }
  }
  return {};
}

/** Current weights as whole percents. Falls back to the documented defaults. */
export function readWeights(): { weights: Weights; source: "portals" | "default" } {
  const doc = loadDoc();
  const ranking = isObj(doc.ranking) ? doc.ranking : null;
  const w = ranking && isObj(ranking.weights) ? (ranking.weights as Record<string, unknown>) : null;
  if (!w) return { weights: { ...DEFAULT_WEIGHTS }, source: "default" };

  const picked: Partial<Record<WeightKey, number>> = {};
  let found = false;
  for (const k of WEIGHT_KEYS) {
    const n = Number(w[k]);
    if (Number.isFinite(n) && n > 0) {
      picked[k] = n;
      found = true;
    }
  }
  if (!found) return { weights: { ...DEFAULT_WEIGHTS }, source: "default" };
  return { weights: normalizeWeights(picked), source: "portals" };
}

/**
 * Merge-safe write of ONLY `ranking.weights`, back in 0–1 fraction form. Every
 * other block in this user-layer file is preserved verbatim.
 */
export function writeWeights(input: Partial<Record<WeightKey, number>>): Weights {
  const weights = normalizeWeights(input);
  const doc = loadDoc();
  const ranking = isObj(doc.ranking) ? { ...doc.ranking } : {};
  const fractions: Record<string, number> = {};
  for (const k of WEIGHT_KEYS) fractions[k] = Number((weights[k] / 100).toFixed(4));
  ranking.weights = fractions;
  doc.ranking = ranking;
  atomicWriteWithBackup(portalsFile(), yaml.dump(doc, { lineWidth: 100, noRefs: true }));
  return weights;
}
