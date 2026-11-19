import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";

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
