import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "./career-ops-root.ts";
import { untrustedContent } from "./untrusted-content.ts";

// Everything an agent may know about the candidate, read by the server and
// embedded in the prompt (agents have no file access). These are the only
// in-scope sources for generated content: keywords get reformulated, never invented.

function read(rel: string, cap: number): string {
  try {
    const text = fs.readFileSync(path.join(careerOpsRoot(), rel), "utf8").trim();
    return text ? untrustedContent(rel, text.slice(0, cap)) : "";
  } catch {
    return "";
  }
}

export function hasCv(): boolean {
  return fs.existsSync(path.join(careerOpsRoot(), "cv.md"));
}

export function candidateContext({ voice = false }: { voice?: boolean } = {}): string {
  const parts = [
    read("cv.md", 80_000),
    read("article-digest.md", 12_000),
    read("config/profile.yml", 12_000),
    read("modes/_profile.md", 12_000),
    read("modes/_custom.md", 8_000),
  ];
  if (voice) {
    parts.push(read("voice-dna.md", 6_000));
    try {
      const dir = path.join(careerOpsRoot(), "writing-samples");
      for (const f of fs.readdirSync(dir).filter((n) => /\.(md|txt)$/i.test(n) && !/^readme/i.test(n)).slice(0, 5)) {
        parts.push(read(path.join("writing-samples", f), 4_000));
      }
    } catch {
      /* no samples */
    }
  }
  return `=== CANDIDATE SOURCES (the user's own files: the only facts you may state about the candidate) ===\n${parts.filter(Boolean).join("\n\n")}`;
}
