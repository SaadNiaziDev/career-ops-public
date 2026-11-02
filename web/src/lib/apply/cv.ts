import fs from "node:fs";
import { artifactFiles, artifactPath } from "@/lib/cv/artifacts";

/**
 * Locate the tailored CV PDF the real `pdf` mode wrote to output/ for a given
 * company (newest match wins). STRICT company match — never returns a CV tailored
 * for a different company (we'd rather attach nothing than the wrong CV). Mirrors
 * the matching in /api/cv-pdf so the "View tailored CV" link and the apply
 * file-upload always resolve to the SAME file. Returns an absolute path or null.
 */
export function resolveTailoredCv(company?: string): string | null {
  const c = (company ?? "").trim();
  if (!c) return null;
  const files = artifactFiles().filter((f) => f.toLowerCase().endsWith(".pdf"));
  // Token-extract instead of replace-then-trim: same slug, and no `-+$`-style
  // pattern that backtracks polynomially on adversarial input (CodeQL).
  const slug = (c.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-");
  const first = slug.split("-")[0];
  const matches = files.filter((f) => {
    const l = f.toLowerCase();
    return l.includes(slug) || (first.length > 2 && l.includes(first));
  });
  const paths = matches.map((f) => artifactPath(f, "pdf")).filter((f): f is string => Boolean(f));
  if (!paths.length) return null;
  paths.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return paths[0];
}

/**
 * Best-effort company name from an application form/page title. ATS titles look
 * like "Role - Region @ Company" (Ashby) or "Company — Role" / "Role at Company".
 * Used as a fallback when the apply flow was started by pasting a URL (no offer
 * context) rather than from a report's Apply button.
 */
export function companyFromTitle(title?: string): string {
  const t = (title ?? "").trim();
  if (!t) return "";
  const at = t.match(/@\s*([^|@]+?)\s*$/);
  if (at) return at[1].trim();
  const atWord = t.match(/\bat\s+([A-Z][\w&.\- ]+?)\s*$/);
  if (atWord) return atWord[1].trim();
  return "";
}
