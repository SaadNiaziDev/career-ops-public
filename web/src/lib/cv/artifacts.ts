import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";

/**
 * System CV exports (JSON payload, HTML, PDF) live in a hidden folder so the
 * user-facing output/ only shows output/applications/. Legacy exports written
 * straight into output/ are still served.
 */
export const CV_ARTIFACT_DIR = "output/.cv";
const ARTIFACT_DIRS = [CV_ARTIFACT_DIR, "output"];

/** Strip the manifest's output/.cv/ or output/ prefix; "" if the path is outside both. */
export function manifestArtifactName(rel?: string): string {
  const match = (rel ?? "").match(/^output\/(?:\.cv\/)?([^/]+)$/);
  return match ? match[1] : "";
}

/** Only regular files directly inside an artifact dir; symlinks cannot escape it. */
export function artifactPath(file: string, extension: "html" | "pdf"): string | null {
  if (!new RegExp(`^[A-Za-z0-9._-]+\\.${extension}$`).test(file)) return null;
  for (const dir of ARTIFACT_DIRS) {
    try {
      const root = fs.realpathSync(path.join(careerOpsRoot(), dir));
      const full = fs.realpathSync(path.join(root, file));
      if (path.dirname(full) === root && fs.statSync(full).isFile()) return full;
    } catch { /* try the next dir */ }
  }
  return null;
}

/** Every file name in the artifact dirs (hidden dir first, so it wins on duplicates). */
export function artifactFiles(): string[] {
  const seen = new Set<string>();
  for (const dir of ARTIFACT_DIRS) {
    try { for (const file of fs.readdirSync(path.join(careerOpsRoot(), dir))) seen.add(file); } catch { /* no exports yet */ }
  }
  return [...seen];
}

export function cvArtifacts() {
  let manifest = "";
  try { manifest = fs.readFileSync(path.join(careerOpsRoot(), "data/pdf-index.tsv"), "utf8"); } catch { /* no exports yet */ }
  const apps = readApplications();
  const entries = manifest.split("\n").filter(line => /^\d+\t/.test(line)).map(line => {
    const [report, pdf, html, format] = line.split("\t");
    return { report: String(Number(report)), pdf, html, format };
  });
  return artifactFiles().filter(file => artifactPath(file, "html")).map(file => {
    const entry = entries.filter(row => manifestArtifactName(row.html) === file).at(-1);
    const app = apps.find(row => Number(row.n) === Number(entry?.report));
    const pdfFile = manifestArtifactName(entry?.pdf);
    // Unindexed exports can be paired only by exact stem, never company substrings.
    const exactPdf = file.replace(/\.html$/, ".pdf");
    const pdf = artifactPath(pdfFile, "pdf") ? pdfFile : artifactPath(exactPdf, "pdf") ? exactPdf : null;
    return { file, label: app ? `${app.company} · ${app.role}` : file, report: entry?.report ?? null,
      pdf, format: entry?.format === "letter" ? "letter" : "a4", mtime: fs.statSync(artifactPath(file, "html")!).mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);
}
