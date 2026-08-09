import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";

export const DEFAULT_CV_SOURCE = "cv.md";

/** Exactly one canonical file, plus anything markdown-ish under the alt-source dir. */
const ALLOWED_FILES = new Set([DEFAULT_CV_SOURCE]);
const ALLOWED_DIRS = ["data/cv-sources/"];
export const CV_SOURCE_EXT_RE = /\.(md|markdown|txt)$/i;

/** Resolve a user-selected CV path safely within the repo. */
export function resolveCvSource(rel: string): string | null {
  const root = careerOpsRoot();
  const cleaned = (rel ?? "").replace(/\\/g, "/").replace(/^\/+/, "").trim();
  if (!cleaned || cleaned.includes("\0")) return null;
  // No traversal segments: `data/cv-sources/../../elsewhere.md` must not pass the
  // prefix test only to escape the repo (or land in a sibling directory).
  if (cleaned.split("/").some((seg) => seg === "." || seg === "..")) return null;

  const allowed =
    ALLOWED_FILES.has(cleaned) ||
    ALLOWED_DIRS.some((dir) => cleaned.startsWith(dir) && cleaned.length > dir.length && CV_SOURCE_EXT_RE.test(cleaned));
  if (!allowed) return null;

  const abs = path.resolve(root, cleaned);
  const back = path.relative(root, abs);
  if (!back || back.startsWith("..") || path.isAbsolute(back)) return null;
  return abs;
}

export type CvSourceEntry = {
  path: string;
  label: string;
  exists: boolean;
  mtime: number;
};

export function listCvSources(activeSource?: string): { active: string; sources: CvSourceEntry[] } {
  const root = careerOpsRoot();
  const active = activeSource?.trim() || DEFAULT_CV_SOURCE;
  const sources: CvSourceEntry[] = [];

  function add(rel: string, label: string) {
    const abs = resolveCvSource(rel);
    if (!abs) return;
    let exists = false;
    let mtime = 0;
    try {
      const st = fs.statSync(abs);
      if (!st.isFile()) return;
      exists = true;
      mtime = st.mtimeMs;
    } catch {
      /* missing */
    }
    sources.push({ path: rel.replace(/\\/g, "/"), label, exists, mtime });
  }

  add(DEFAULT_CV_SOURCE, "cv.md (canonical)");

  const altDir = path.join(root, "data", "cv-sources");
  try {
    for (const f of fs.readdirSync(altDir)) {
      if (!CV_SOURCE_EXT_RE.test(f)) continue;
      add(`data/cv-sources/${f}`, f);
    }
  } catch {
    /* no alt dir */
  }

  if (active !== DEFAULT_CV_SOURCE && !sources.some((s) => s.path === active)) {
    add(active, path.basename(active));
  }

  sources.sort((a, b) => {
    if (a.path === DEFAULT_CV_SOURCE) return -1;
    if (b.path === DEFAULT_CV_SOURCE) return 1;
    return b.mtime - a.mtime;
  });

  return { active, sources };
}

export function readCvSource(rel: string): { content: string; exists: boolean; path: string } {
  const abs = resolveCvSource(rel);
  if (!abs) throw new Error("invalid cv source path");
  try {
    return { content: fs.readFileSync(abs, "utf8"), exists: true, path: rel.replace(/\\/g, "/") };
  } catch {
    return { content: "", exists: false, path: rel.replace(/\\/g, "/") };
  }
}

export function cvSourcesDir(): string {
  const dir = path.join(careerOpsRoot(), "data", "cv-sources");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
