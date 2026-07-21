import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

export type TitleSuggestion = {
  title: string;
  axis: "Lateral" | "Stretch" | "Pivot" | string;
  evidence: string;
  gap: string;
  market: string;
  keyword: string;
};

export type TitlesSuggestionsFile = {
  generatedAt: string;
  suggestions: TitleSuggestion[];
};

function suggestionsPath(): string {
  return path.join(careerOpsRoot(), "data", "titles-suggestions.json");
}

export function readTitleSuggestions(): TitlesSuggestionsFile | null {
  try {
    const raw = fs.readFileSync(suggestionsPath(), "utf8");
    const parsed = JSON.parse(raw) as TitlesSuggestionsFile;
    if (!Array.isArray(parsed.suggestions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTitleSuggestions(data: TitlesSuggestionsFile): void {
  const p = suggestionsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + "\n", "utf8");
}
