import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite, atomicWriteWithBackup } from "@/lib/core/safe-write";
import { fetchPublicUrl } from "@/lib/public-url-policy";
import {
  PROOF_KIND_SET,
  STATUS_OPTIONS,
  VOICE_DNA_MARKER,
  classifyProofUrl,
  detectStyle,
  githubHandle,
  parseCvRoles,
  voiceDnaMarkdown,
  type BrainStatus,
  type CvRole,
  type Proof,
  type StyleReport,
  type Tone,
} from "@/lib/brain-shared";

// Server side of the Brain page. Everything lives in user-layer files the
// outreach worker already reads: the `outreach:` block of config/profile.yml,
// writing-samples/*.md and voice-dna.md. Never invents content: it stores what
// the user typed or what their own links say about themselves.

export type BrainSample = { file: string; words: number; preview: string; mine: boolean };
export type GithubRepo = { name: string; url: string; description: string; stars: number; language: string; pushedAt: string; fork: boolean };
export type GithubInfo = { handle: string; publicRepos: number; repos: GithubRepo[]; error?: string };

export type BrainState = {
  profileExists: boolean;
  proofs: Proof[];
  status: BrainStatus[];
  x: string;
  site: string;
  calendarLink: string;
  notes: string;
  tone: Tone | "";
  neverSay: string[];
  githubHandle: string;
  samples: BrainSample[];
  style: StyleReport | null;
  voiceDna: "brain" | "custom" | "none";
  cv: { exists: boolean; words: number; roles: CvRole[] };
};

const STATUS_SET = new Set(STATUS_OPTIONS.map((s) => s.value));
const SAMPLE_DIR = "writing-samples";
const MAX_PROOFS = 30;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function str(v: unknown, cap = 4000): string {
  return typeof v === "string" ? v.trim().slice(0, cap) : "";
}

export class BrainError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function profilePath() {
  return path.join(careerOpsRoot(), "config", "profile.yml");
}

/** Read profile.yml. Missing → {} with exists=false. Malformed → throws (never overwrite it). */
function readProfile(): { doc: Record<string, unknown>; exists: boolean } {
  const file = profilePath();
  if (!fs.existsSync(file)) return { doc: {}, exists: false };
  let parsed: unknown;
  try {
    parsed = yaml.load(fs.readFileSync(file, "utf8"));
  } catch {
    throw new BrainError("config/profile.yml exists but is not valid YAML, so Brain won't touch it.", 409);
  }
  if (parsed == null) return { doc: {}, exists: true };
  if (!isObj(parsed)) throw new BrainError("config/profile.yml must be a YAML mapping.", 409);
  return { doc: parsed, exists: true };
}

/** Back up at most once per 10 minutes, so blur-autosave doesn't litter config/. */
function writeProfile(doc: Record<string, unknown>) {
  const file = profilePath();
  const dir = path.dirname(file);
  const base = path.basename(file);
  let recent = false;
  try {
    const cutoff = Date.now() - 10 * 60_000;
    recent = fs.readdirSync(dir).some((n) => n.startsWith(`${base}.bak-`) && fs.statSync(path.join(dir, n)).mtimeMs > cutoff);
  } catch {
    /* no dir yet */
  }
  const text = yaml.dump(doc, { lineWidth: 100, noRefs: true });
  if (recent) atomicWrite(file, text);
  else atomicWriteWithBackup(file, text);
}

function cleanProof(raw: unknown): Proof | null {
  if (!isObj(raw)) return null;
  const url = str(raw.url, 2000);
  if (!/^https?:\/\/\S+$/i.test(url)) return null;
  const kind = PROOF_KIND_SET.has(raw.kind as Proof["kind"]) ? (raw.kind as Proof["kind"]) : classifyProofUrl(url);
  const p: Proof = { kind, url };
  const title = str(raw.title, 160);
  const summary = str(raw.summary, 300);
  if (title) p.title = title;
  if (summary) p.summary = summary;
  if (raw.starred === true) p.starred = true;
  return p;
}

function outreachOf(doc: Record<string, unknown>): Record<string, unknown> {
  return isObj(doc.outreach) ? doc.outreach : {};
}

/** The star is outreach.lead_proof, so Outreach's "Your voice" and Brain never disagree. */
function proofsWithStar(o: Record<string, unknown>): Proof[] {
  const lead = str(o.lead_proof, 2000);
  const list = (Array.isArray(o.proofs) ? o.proofs : []).map(cleanProof).filter((p): p is Proof => !!p);
  const out = list.map((p) => ({ ...p, starred: !!lead && p.url === lead }));
  if (lead && !out.some((p) => p.starred) && /^https?:\/\//i.test(lead)) out.unshift({ kind: classifyProofUrl(lead), url: lead, starred: true });
  return out.map((p) => (p.starred ? p : (({ starred: _s, ...rest }) => rest)(p)));
}

function cvSummary(root: string) {
  try {
    const text = fs.readFileSync(path.join(root, "cv.md"), "utf8");
    return { exists: true, words: text.split(/\s+/).filter(Boolean).length, roles: parseCvRoles(text) };
  } catch {
    return { exists: false, words: 0, roles: [] };
  }
}

function sampleFiles(root: string): string[] {
  try {
    return fs
      .readdirSync(path.join(root, SAMPLE_DIR))
      .filter((n) => /\.(md|txt)$/i.test(n) && !/^readme/i.test(n))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } catch {
    return [];
  }
}

function readSamples(root: string): { list: BrainSample[]; texts: string[] } {
  const list: BrainSample[] = [];
  const texts: string[] = [];
  for (const file of sampleFiles(root)) {
    try {
      const text = fs.readFileSync(path.join(root, SAMPLE_DIR, file), "utf8");
      texts.push(text);
      const flat = text.replace(/\s+/g, " ").trim();
      list.push({ file, words: flat ? flat.split(" ").length : 0, preview: flat.slice(0, 140), mine: /^sample-\d+\.md$/.test(file) });
    } catch {
      /* unreadable sample */
    }
  }
  return { list, texts };
}

function voiceDnaState(root: string): BrainState["voiceDna"] {
  try {
    const text = fs.readFileSync(path.join(root, "voice-dna.md"), "utf8");
    return text.startsWith(VOICE_DNA_MARKER) ? "brain" : text.trim() ? "custom" : "none";
  } catch {
    return "none";
  }
}

export function readBrain(): BrainState {
  const root = careerOpsRoot();
  const { doc, exists } = readProfile();
  const o = outreachOf(doc);
  const candidate = isObj(doc.candidate) ? doc.candidate : {};
  const proofs = proofsWithStar(o);
  const ghProof = proofs.find((p) => p.kind === "github");
  const { list, texts } = readSamples(root);
  const tone = str(o.tone);
  return {
    profileExists: exists,
    proofs,
    status: (Array.isArray(o.status) ? o.status : typeof o.status === "string" ? [o.status] : []).filter((s): s is BrainStatus => STATUS_SET.has(s as BrainStatus)),
    x: str(o.x) || str(candidate.twitter),
    site: str(o.site) || str(candidate.portfolio_url),
    calendarLink: str(o.calendar_link),
    notes: str(o.notes, 8000),
    tone: tone === "polite" || tone === "confident" || tone === "spicy" ? tone : "",
    neverSay: Array.isArray(o.never_say) ? o.never_say.filter((v): v is string => typeof v === "string") : [],
    githubHandle: githubHandle(ghProof?.url) || githubHandle(candidate.github) || githubHandle(doc.github),
    samples: list,
    style: detectStyle(texts),
    voiceDna: voiceDnaState(root),
    cv: cvSummary(root),
  };
}

export type BrainPatch = { proofs?: unknown; status?: unknown; x?: unknown; site?: unknown; notes?: unknown };

/** Merge Brain fields into outreach: only. Every other key in profile.yml is kept as is. */
export function saveBrain(patch: BrainPatch): BrainState {
  const { doc, exists } = readProfile();
  let base = doc;
  if (!exists) {
    try {
      const seed = yaml.load(fs.readFileSync(path.join(careerOpsRoot(), "config", "profile.example.yml"), "utf8"));
      base = isObj(seed) ? seed : {};
    } catch {
      base = {};
    }
  }
  const o: Record<string, unknown> = { ...outreachOf(base) };
  if (patch.proofs !== undefined) {
    if (!Array.isArray(patch.proofs)) throw new BrainError("proofs must be a list.");
    if (patch.proofs.length > MAX_PROOFS) throw new BrainError(`Keep it to ${MAX_PROOFS} links or fewer.`);
    const cleaned = patch.proofs.map(cleanProof);
    if (cleaned.some((p) => !p)) throw new BrainError("Each link must be a full https:// address.");
    const seen = new Set<string>();
    const proofs = (cleaned as Proof[]).filter((p) => !seen.has(p.url) && !!seen.add(p.url));
    const starred = proofs.filter((p) => p.starred);
    if (starred.length > 1) throw new BrainError("Only one link can lead.");
    const prevUrls = new Set(proofsWithStar(outreachOf(base)).map((p) => p.url));
    if (starred[0]) o.lead_proof = starred[0].url;
    else if (typeof o.lead_proof === "string" && prevUrls.has(o.lead_proof)) delete o.lead_proof;
    o.proofs = proofs;
  }
  if (patch.status !== undefined) {
    if (!Array.isArray(patch.status) || patch.status.some((s) => !STATUS_SET.has(s as BrainStatus))) throw new BrainError("Unknown status.");
    o.status = [...new Set(patch.status as BrainStatus[])];
  }
  for (const key of ["x", "site"] as const) {
    if (patch[key] === undefined) continue;
    if (typeof patch[key] !== "string" || (patch[key] as string).length > 300) throw new BrainError(`${key} must be short text.`);
    const v = (patch[key] as string).trim();
    if (key === "site" && v && !/^https?:\/\/\S+$/i.test(v)) throw new BrainError("Site must be a full https:// link.");
    if (key === "x" && v && !/^(@?[A-Za-z0-9_]{1,15}|https?:\/\/(www\.)?(x|twitter)\.com\/[A-Za-z0-9_]{1,15}\/?)$/i.test(v)) throw new BrainError("Use your X handle (@you) or profile link.");
    if (v) o[key] = v;
    else delete o[key];
  }
  if (patch.notes !== undefined) {
    if (typeof patch.notes !== "string" || patch.notes.length > 8000) throw new BrainError("Notes must be text up to 8,000 characters.");
    const v = patch.notes.trim();
    if (v) o.notes = v;
    else delete o.notes;
  }
  writeProfile({ ...base, outreach: o });
  return readBrain();
}

// ── Writing samples + voice-dna.md ──────────────────────────────────────────

function refreshVoiceDna(root: string) {
  const file = path.join(root, "voice-dna.md");
  const state = voiceDnaState(root);
  if (state === "custom") return; // the user wrote their own; never overwrite it
  const { texts } = readSamples(root);
  const style = detectStyle(texts);
  if (!style) {
    if (state === "brain") fs.rmSync(file, { force: true });
    return;
  }
  atomicWrite(file, voiceDnaMarkdown(style, texts.length));
}

export function addSample(text: unknown): BrainState {
  if (typeof text !== "string") throw new BrainError("Paste some text first.");
  const body = text.replace(/\r\n/g, "\n").trim();
  const words = body.split(/\s+/).filter(Boolean).length;
  if (words < 30) throw new BrainError("Paste a bit more, at least 30 words, so the style reads true.");
  if (body.length > 20_000) throw new BrainError("That's long. Paste up to 20,000 characters.");
  const root = careerOpsRoot();
  const dir = path.join(root, SAMPLE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const nums = sampleFiles(root).map((n) => Number(n.match(/^sample-(\d+)\.md$/)?.[1] ?? 0));
  const next = Math.max(0, ...nums) + 1;
  atomicWrite(path.join(dir, `sample-${next}.md`), `${body}\n`);
  refreshVoiceDna(root);
  return readBrain();
}

export function deleteSample(file: unknown): BrainState {
  if (typeof file !== "string" || !/^sample-\d+\.md$/.test(file)) throw new BrainError("Only samples added here can be removed here.");
  const root = careerOpsRoot();
  fs.rmSync(path.join(root, SAMPLE_DIR, file), { force: true });
  refreshVoiceDna(root);
  return readBrain();
}

// ── Link metadata ───────────────────────────────────────────────────────────

const UA = "career-ops-brain/1.0 (+local)";

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function metaContent(html: string, names: string[]): string {
  for (const name of names) {
    const re1 = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i");
    const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i");
    const m = html.match(re1) ?? html.match(re2);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return "";
}

async function getJson(url: string): Promise<unknown> {
  const res = await fetchPublicUrl(url, { headers: { "user-agent": UA, accept: "application/vnd.github+json" } }, { timeoutMs: 6000, maxBytes: 2_000_000, maxRedirects: 2 });
  if (!res.ok) throw new Error(res.status === 404 ? "not found on GitHub" : res.status === 403 ? "GitHub rate limit, try again later" : `GitHub said ${res.status}`);
  return res.json();
}

export async function fetchProofMeta(raw: unknown): Promise<{ title: string; summary: string }> {
  if (typeof raw !== "string" || !/^https?:\/\/\S+$/i.test(raw.trim())) throw new BrainError("Use a full https:// link.");
  const url = raw.trim();
  const u = new URL(url);
  const host = u.hostname.replace(/^www\./, "");
  const parts = u.pathname.split("/").filter(Boolean);
  if (host === "github.com" && parts.length >= 1) {
    try {
      if (parts.length >= 2) {
        const r = (await getJson(`https://api.github.com/repos/${parts[0]}/${parts[1]}`)) as Record<string, unknown>;
        const stars = Number(r.stargazers_count) || 0;
        const lang = str(r.language);
        return { title: str(r.full_name) || `${parts[0]}/${parts[1]}`, summary: [str(r.description, 240), [lang, stars ? `${stars}★` : ""].filter(Boolean).join(" · ")].filter(Boolean).join(" — ") };
      }
      const user = (await getJson(`https://api.github.com/users/${parts[0]}`)) as Record<string, unknown>;
      return { title: `@${str(user.login) || parts[0]}`, summary: [str(user.bio, 200), `${Number(user.public_repos) || 0} public repos`].filter(Boolean).join(" · ") };
    } catch {
      /* fall through to plain HTML */
    }
  }
  const res = await fetchPublicUrl(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" } }, { timeoutMs: 6000, maxBytes: 1_500_000, maxRedirects: 4 });
  if (!res.ok) throw new BrainError(`That page answered ${res.status}.`, 502);
  const type = res.headers.get("content-type") || "";
  if (!/html|xml/i.test(type)) return { title: host, summary: "" };
  const html = (await res.text()).slice(0, 400_000);
  const title = metaContent(html, ["og:title", "twitter:title"]) || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || host;
  const summary = metaContent(html, ["og:description", "description", "twitter:description"]);
  return { title: title.slice(0, 160), summary: summary.slice(0, 300) };
}

// ── GitHub repos (public API, no auth, 10-minute cache) ─────────────────────

const ghCache = new Map<string, { at: number; info: GithubInfo }>();

export async function githubInfo(handle: string): Promise<GithubInfo> {
  const h = githubHandle(handle);
  if (!h) return { handle: "", publicRepos: 0, repos: [], error: "No GitHub handle yet." };
  const hit = ghCache.get(h.toLowerCase());
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.info;
  let info: GithubInfo;
  try {
    const [user, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${h}`) as Promise<Record<string, unknown>>,
      getJson(`https://api.github.com/users/${h}/repos?sort=pushed&per_page=100&type=owner`) as Promise<Record<string, unknown>[]>,
    ]);
    info = {
      handle: str(user.login) || h,
      publicRepos: Number(user.public_repos) || 0,
      repos: (Array.isArray(repos) ? repos : [])
        .filter((r) => isObj(r) && !r.archived && String(r.name).toLowerCase() !== h.toLowerCase()) // skip the profile README repo
        .map((r) => ({
          name: str(r.name),
          url: str(r.html_url),
          description: str(r.description, 240),
          stars: Number(r.stargazers_count) || 0,
          language: str(r.language),
          pushedAt: str(r.pushed_at),
          fork: r.fork === true,
        })),
    };
    ghCache.set(h.toLowerCase(), { at: Date.now(), info });
  } catch (e) {
    info = { handle: h, publicRepos: 0, repos: [], error: e instanceof Error ? e.message : "GitHub didn't answer." };
    ghCache.set(h.toLowerCase(), { at: Date.now() - 8 * 60_000, info }); // retry failures after ~2 minutes
  }
  return info;
}
