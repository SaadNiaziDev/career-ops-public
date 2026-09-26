import path from "node:path";

const ROUND_TYPES = ["hiring-manager", "system-design", "screen", "technical", "behavioral", "onsite", "final", "practice"];

export function slugifySessionIdentity(value = "") {
  return String(value).trim().toLowerCase().normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
}

export function sessionFilenameParts(file) {
  const base = path.basename(file, ".md");
  const match = base.match(/-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  const date = match[1];
  const beforeDate = base.slice(0, -(date.length + 1));
  const round = ROUND_TYPES.find((type) => beforeDate.endsWith(`-${type}`));
  if (!round) return null;
  return { prefix: beforeDate.slice(0, -(round.length + 1)), round, date };
}

/** Resolve ownership conservatively. Explicit tracker_num is authoritative; legacy files need one exact company/role owner. */
/**
 * @param {{file: string, frontmatter?: Record<string, string>, applications?: Array<{n: string | number, company: string, role: string}>}} input
 * @returns {{status: "matched", trackerNum: string, method: "tracker_num" | "legacy_exact"} | {status: "orphaned", trackerNum: string} | {status: "ambiguous", candidates: string[]} | {status: "unmatched", candidates: string[]}}
 */
export function resolveSessionOwner({ file, frontmatter = {}, applications = [] }) {
  const taggedNum = String(frontmatter.tracker_num ?? "").trim();
  if (taggedNum) {
    const app = applications.find((candidate) => String(candidate.n) === taggedNum);
    return app ? { status: "matched", trackerNum: taggedNum, method: "tracker_num" } : { status: "orphaned", trackerNum: taggedNum };
  }

  const parts = sessionFilenameParts(file);
  if (!parts) return { status: "unmatched", candidates: [] };
  const frontCompany = frontmatter.company ? slugifySessionIdentity(frontmatter.company) : "";
  const frontRole = frontmatter.role ? slugifySessionIdentity(frontmatter.role) : "";
  const hasFullIdentityMetadata = Boolean(frontCompany && frontRole);
  const matches = applications.filter((app) => {
    const company = slugifySessionIdentity(app.company);
    const role = slugifySessionIdentity(app.role);
    return (hasFullIdentityMetadata || `${company}-${role}` === parts.prefix)
      && (!frontCompany || company === frontCompany)
      && (!frontRole || role === frontRole);
  });
  const candidateNums = [...new Set(matches.map((app) => String(app.n)))];
  if (candidateNums.length === 1) return { status: "matched", trackerNum: candidateNums[0], method: "legacy_exact" };
  if (candidateNums.length > 1) return { status: "ambiguous", candidates: candidateNums };
  return { status: "unmatched", candidates: [] };
}

export function planSessionBackfill(files, applications) {
  return files.map(({ file, content, frontmatter = {} }) => {
    if (String(frontmatter.tracker_num ?? "").trim()) {
      return { file, status: "already-tagged", trackerNum: String(frontmatter.tracker_num).trim() };
    }
    const owner = resolveSessionOwner({ file, frontmatter, applications });
    return { file, ...owner };
  });
}
