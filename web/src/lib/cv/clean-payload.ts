// Clean an AI-written tailored-CV payload before rendering: trim text, drop empty
// fields and placeholder entries, cap projects, and report anything still missing.

type Json = unknown;
type Entry = Record<string, Json>;

const MAX_PROJECTS = 4;

/** Entries a list section keeps only when this field has text. */
const REQUIRED: Record<string, (e: Entry) => boolean> = {
  experience: (e) => has(e.company) && has(e.role),
  projects: (e) => has(e.name),
  open_source: (e) => has(e.project),
  awards: (e) => has(e.title),
  certifications: (e) => has(e.title),
  education: (e) => has(e.title) || has(e.org),
  skills: (e) => has(e.category) && (has(e.items) || (Array.isArray(e.items) && e.items.length > 0)),
};

function has(v: Json): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Recursively trim strings and remove empty strings, arrays and objects. */
function prune(v: Json): Json {
  if (typeof v === "string") return v.trim() || undefined;
  if (Array.isArray(v)) {
    const items = v.map(prune).filter((x) => x !== undefined);
    return items.length ? items : undefined;
  }
  if (v && typeof v === "object") {
    const out = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, prune(x)]).filter(([, x]) => x !== undefined));
    return Object.keys(out).length ? out : undefined;
  }
  return v ?? undefined;
}

export type CleanResult = { payload: Entry; problems: string[] };

export function cleanCvPayload(raw: Json): CleanResult {
  const payload = ((prune(raw) as Entry | undefined) ?? {}) as Entry;
  for (const [key, keep] of Object.entries(REQUIRED)) {
    const list = Array.isArray(payload[key]) ? (payload[key] as Entry[]).filter((e) => e && typeof e === "object" && keep(e)) : [];
    if (list.length) payload[key] = list;
    else delete payload[key];
  }
  if (Array.isArray(payload.projects)) payload.projects = (payload.projects as Entry[]).slice(0, MAX_PROJECTS);
  // The renderer needs these arrays even when empty.
  for (const key of ["experience", "education", "skills"]) payload[key] ??= [];

  const candidate = (payload.candidate ?? {}) as Entry;
  const problems: string[] = [];
  if (payload.contract_version !== "1.0") problems.push("wrong CV format");
  if (!has(candidate.name)) problems.push("missing your name");
  if (!has(candidate.headline)) problems.push("missing a headline");
  if (!has(payload.summary)) problems.push("missing a summary");
  if (!(payload.experience as Entry[]).length) problems.push("no work experience");
  return { payload, problems };
}
