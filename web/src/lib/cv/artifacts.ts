import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";

/** Only regular files within output; symlinks cannot escape the artifact directory. */
export function artifactPath(file: string, extension: "html" | "pdf"): string | null {
  if (!new RegExp(`^[A-Za-z0-9._-]+\\.${extension}$`).test(file)) return null;
  try {
    const root = fs.realpathSync(path.join(careerOpsRoot(), "output"));
    const full = fs.realpathSync(path.join(root, file));
    if (path.dirname(full) !== root || !fs.statSync(full).isFile()) return null;
    return full;
  } catch { return null; }
}

export function cvArtifacts() {
  let manifest = "";
  let files: string[] = [];
  try { manifest = fs.readFileSync(path.join(careerOpsRoot(), "data/pdf-index.tsv"), "utf8"); } catch { /* no exports yet */ }
  try { files = fs.readdirSync(path.join(careerOpsRoot(), "output")); } catch { /* no exports yet */ }
  const apps = readApplications();
  const entries = manifest.split("\n").filter(line => /^\d+\t/.test(line)).map(line => {
    const [report, pdf, html, format] = line.split("\t");
    return { report: String(Number(report)), pdf, html, format };
  });
  return files.filter(file => artifactPath(file, "html")).map(file => {
    const entry = entries.filter(row => row.html === `output/${file}`).at(-1);
    const app = apps.find(row => Number(row.n) === Number(entry?.report));
    const pdfFile = entry?.pdf?.startsWith("output/") ? entry.pdf.slice(7) : "";
    // Unindexed exports can be paired only by exact stem, never company substrings.
    const exactPdf = file.replace(/\.html$/, ".pdf");
    const pdf = artifactPath(pdfFile, "pdf") ? pdfFile : artifactPath(exactPdf, "pdf") ? exactPdf : null;
    return { file, label: app ? `${app.company} · ${app.role}` : file, report: entry?.report ?? null,
      pdf, format: entry?.format === "letter" ? "letter" : "a4", mtime: fs.statSync(artifactPath(file, "html")!).mtimeMs };
  }).sort((a, b) => b.mtime - a.mtime);
}
