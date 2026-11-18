// Client-safe Brain helpers: proof kinds, style detection, sharpness score and
// CV role parsing. Pure functions only, so the page and the API agree and the
// logic is testable without a server.

export type ProofKind = "github" | "portfolio" | "loom" | "demo" | "case-study" | "writing" | "designs" | "launch" | "repo" | "other";

export type Proof = {
  kind: ProofKind;
  url: string;
  title?: string;
  summary?: string;
  starred?: boolean;
};

export type BrainStatus = "open-to-work" | "freelance" | "building";
export type Tone = "polite" | "confident" | "spicy";

export const STATUS_OPTIONS: { value: BrainStatus; label: string; icon: string }[] = [
  { value: "open-to-work", label: "Open to work", icon: "work" },
  { value: "freelance", label: "Taking freelance", icon: "handshake" },
  { value: "building", label: "Building something", icon: "construction" },
];

export const PROOF_KINDS: { kind: ProofKind; label: string; hint: string; icon: string; placeholder: string }[] = [
  { kind: "github", label: "GitHub", hint: "Your profile", icon: "code", placeholder: "https://github.com/you" },
  { kind: "portfolio", label: "Portfolio", hint: "Your site or work page", icon: "web", placeholder: "https://you.dev" },
  { kind: "loom", label: "Loom", hint: "A short walkthrough video", icon: "videocam", placeholder: "https://www.loom.com/share/…" },
  { kind: "demo", label: "Live demo", hint: "Something people can click", icon: "rocket_launch", placeholder: "https://app.you.dev" },
  { kind: "case-study", label: "Case study", hint: "Notion, doc or deck", icon: "description", placeholder: "https://notion.so/…" },
  { kind: "writing", label: "Writing", hint: "Substack or blog", icon: "edit_note", placeholder: "https://you.substack.com" },
  { kind: "designs", label: "Designs", hint: "Dribbble, Behance or Figma", icon: "palette", placeholder: "https://dribbble.com/you" },
  { kind: "launch", label: "Launch", hint: "Product Hunt or App Store", icon: "celebration", placeholder: "https://www.producthunt.com/posts/…" },
  { kind: "repo", label: "Repo", hint: "A single project", icon: "folder_code", placeholder: "https://github.com/you/project" },
  { kind: "other", label: "Something else", hint: "Anything that shows your work", icon: "link", placeholder: "https://…" },
];

export const PROOF_KIND_SET = new Set<ProofKind>(PROOF_KINDS.map((k) => k.kind));

export function proofKindMeta(kind: ProofKind) {
  return PROOF_KINDS.find((k) => k.kind === kind) ?? PROOF_KINDS[PROOF_KINDS.length - 1];
}

/** Best-guess kind from a URL, used when a link arrives without a slot. */
export function classifyProofUrl(raw: string): ProofKind {
  let host = "";
  let parts: string[] = [];
  try {
    const u = new URL(raw);
    host = u.hostname.replace(/^www\./, "").toLowerCase();
    parts = u.pathname.split("/").filter(Boolean);
  } catch {
    return "other";
  }
  if (host === "github.com") return parts.length >= 2 ? "repo" : "github";
  if (host.endsWith("loom.com")) return "loom";
  if (/(^|\.)(notion\.so|notion\.site|docs\.google\.com|pitch\.com|canva\.com)$/.test(host)) return "case-study";
  if (/(substack\.com|medium\.com|dev\.to|hashnode\.(dev|com)|mirror\.xyz)$/.test(host)) return "writing";
  if (/(dribbble\.com|behance\.net|figma\.com)$/.test(host)) return "designs";
  if (/(producthunt\.com|apps\.apple\.com|play\.google\.com)$/.test(host)) return "launch";
  if (/(vercel\.app|netlify\.app|pages\.dev|herokuapp\.com|fly\.dev|onrender\.com)$/.test(host)) return "demo";
  return "other";
}

/** "github.com/SaadNiaziDev", "@x", or a full URL → "SaadNiaziDev". */
export function githubHandle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const s = raw.trim().replace(/^@/, "");
  if (!s) return "";
  const m = s.match(/github\.com\/([A-Za-z0-9-]{1,39})(?:[/?#]|$)/i);
  if (m) return m[1];
  return /^[A-Za-z0-9-]{1,39}$/.test(s) ? s : "";
}

export function normalizeUrl(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function displayHost(raw: string): string {
  try {
    const u = new URL(raw);
    const p = u.pathname.replace(/\/$/, "");
    return `${u.hostname.replace(/^www\./, "")}${p.length > 1 ? p : ""}`;
  } catch {
    return raw;
  }
}

// ── Writing style ───────────────────────────────────────────────────────────

export type StyleReport = {
  words: number;
  sentences: number;
  avgSentence: number;
  sentenceLength: "short" | "medium" | "long";
  capitals: "proper" | "lowercase" | "mixed";
  exclamations: number;
  emoji: number;
  contractionsPer100: number;
  questions: number;
  dashes: number;
  signOff: string | null;
  chips: string[];
};

const EMOJI = /\p{Extended_Pictographic}/gu;
const SIGN_OFF = /^(cheers|thanks|thank you|thanks again|best|best regards|kind regards|regards|warmly|talk soon|speak soon|all the best|sincerely|ttyl)\b[,!.]?/i;

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1");
}

export function detectStyle(samples: string[]): StyleReport | null {
  const texts = samples.map((s) => s.trim()).filter(Boolean);
  if (!texts.length) return null;
  const clean = texts.map(stripMarkdown);
  const all = clean.join("\n\n");
  const words = all.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  const sentences = all
    .split(/(?<=[.!?])\s+|\n{2,}|\n(?=\s*[\p{Lu}\p{Ll}])/u)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length >= 3);
  const sentenceCount = Math.max(1, sentences.length);
  const avg = Math.round(words.length / sentenceCount);
  const starts = sentences.map((s) => s.replace(/^[^\p{L}]+/u, "")[0]).filter(Boolean);
  const upper = starts.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length;
  const upperShare = starts.length ? upper / starts.length : 1;
  const lowerI = (all.match(/(^|\s)i(\s|'|’)/g) || []).length;
  const capitals: StyleReport["capitals"] = upperShare >= 0.8 && lowerI === 0 ? "proper" : upperShare <= 0.3 ? "lowercase" : "mixed";
  const exclamations = (all.match(/!/g) || []).length;
  const emoji = (all.match(EMOJI) || []).length;
  const contractions = (all.match(/\b[\p{L}]+['’](s|re|ve|ll|d|t|m)\b/giu) || []).length;
  const contractionsPer100 = words.length ? Math.round((contractions / words.length) * 1000) / 10 : 0;
  const questions = (all.match(/\?/g) || []).length;
  const dashes = (all.match(/\s[—–-]\s|—/g) || []).length;
  let signOff: string | null = null;
  for (const t of texts) {
    const lines = t.split("\n").map((l) => l.trim()).filter(Boolean).slice(-3);
    const hit = lines.map((l) => l.match(SIGN_OFF)?.[0]).find(Boolean);
    if (hit) {
      signOff = hit.replace(/[,!.]$/, "");
      break;
    }
  }
  const sentenceLength: StyleReport["sentenceLength"] = avg < 12 ? "short" : avg <= 20 ? "medium" : "long";
  const chips = [
    capitals === "proper" ? "proper capitals" : capitals === "lowercase" ? "all lowercase" : "mixed capitals",
    `${sentenceLength} sentences (~${avg} words)`,
    exclamations === 0 ? "no exclamation marks" : `uses exclamation marks (${exclamations})`,
    emoji === 0 ? "no emoji" : `uses emoji (${emoji})`,
    contractionsPer100 >= 1.5 ? "lots of contractions" : contractionsPer100 > 0 ? "some contractions" : "no contractions",
  ];
  if (questions > 0) chips.push(`asks questions (${questions})`);
  if (dashes > 0) chips.push("uses dashes");
  if (signOff) chips.push(`signs off "${signOff}"`);
  return {
    words: words.length,
    sentences: sentences.length,
    avgSentence: avg,
    sentenceLength,
    capitals,
    exclamations,
    emoji,
    contractionsPer100,
    questions,
    dashes,
    signOff,
    chips,
  };
}

/** Style-only voice guide. Never quotes the samples, so no facts leak into it. */
export function voiceDnaMarkdown(style: StyleReport, sampleCount: number): string {
  const rules = [
    style.capitals === "proper" ? "Use normal sentence capitalisation." : style.capitals === "lowercase" ? "Write in lowercase, including the start of sentences." : "Capitalisation is relaxed; don't over-polish it.",
    `Keep sentences ${style.sentenceLength}, around ${style.avgSentence} words on average.`,
    style.exclamations === 0 ? "No exclamation marks." : "Exclamation marks are fine, but sparingly.",
    style.emoji === 0 ? "No emoji." : "An emoji is fine where it feels natural.",
    style.contractionsPer100 >= 1.5 ? "Use contractions freely (I'm, don't, it's)." : style.contractionsPer100 > 0 ? "Use contractions now and then." : "Avoid contractions.",
    style.dashes > 0 ? "Dashes are part of the voice, but keep them rare." : "Don't use dashes for asides; use commas or full stops.",
  ];
  if (style.signOff) rules.push(`Sign off with "${style.signOff}".`);
  return [
    "<!-- Written by the Brain page from writing-samples/. Style only, never facts. Remove this line to stop Brain overwriting the file. -->",
    "# Voice DNA",
    "",
    `Measured from ${sampleCount} writing sample${sampleCount === 1 ? "" : "s"} (${style.words} words). Copy how I write, never what I wrote.`,
    "",
    ...rules.map((r) => `- ${r}`),
    "",
  ].join("\n");
}

export const VOICE_DNA_MARKER = "<!-- Written by the Brain page";

// ── CV roles ────────────────────────────────────────────────────────────────

export type CvRole = { title: string; company: string; dates: string };

const DATE_RANGE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*[-–—]+\s*(((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}|present|current|now)/i;

/** Pull roles out of the experience section of cv.md. Handles both
 *  "### Title | Company | City | Dates" and "### Company -- City" + "**Title**". */
export function parseCvRoles(markdown: string): CvRole[] {
  const lines = markdown.split("\n");
  const roles: CvRole[] = [];
  let inExp = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h2 = line.match(/^##\s+(.+)/);
    if (h2 && !line.startsWith("###")) {
      inExp = /experience|employment|work history/i.test(h2[1]);
      continue;
    }
    if (!inExp) continue;
    const h3 = line.match(/^###\s+(.+)/);
    if (!h3) continue;
    const heading = h3[1].replace(/\*\*/g, "").trim();
    const parts = heading.split(/\s+\|\s+/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const dates = parts.find((p) => DATE_RANGE.test(p)) ?? "";
      const rest = parts.filter((p) => p !== dates);
      roles.push({ title: rest[0] ?? "", company: rest[1] ?? "", dates: dates.replace(/\s*\(.*\)\s*$/, "") });
      continue;
    }
    const company = heading.split(/\s+(?:--|—|–)\s+/)[0].trim();
    let title = "";
    let dates = "";
    for (let j = i + 1; j < Math.min(lines.length, i + 6); j++) {
      const l = lines[j].trim();
      if (/^#{1,3}\s/.test(l)) break;
      const bold = l.match(/^\*\*(.+?)\*\*/);
      if (!title && bold) title = bold[1].trim();
      const d = l.match(DATE_RANGE);
      if (!dates && d) dates = d[0];
    }
    roles.push({ title: title || company, company: title ? company : "", dates });
  }
  return roles.slice(0, 20);
}

// ── Sharpness ───────────────────────────────────────────────────────────────

export type BrainSnapshot = {
  proofs: Proof[];
  githubHandle: string;
  status: BrainStatus[];
  x: string;
  site: string;
  calendarLink: string;
  tone: Tone | "";
  neverSay: string[];
  sampleCount: number;
  cvWords: number;
  notes: string;
};

export type SectionId = "proof" | "find" | "write" | "cv" | "notes";
export type SharpnessItem = { id: string; section: SectionId; label: string; points: number; done: boolean };

export function sharpnessItems(s: BrainSnapshot): SharpnessItem[] {
  return [
    { id: "proof-1", section: "proof", label: "Add a piece of proof", points: 20, done: s.proofs.length >= 1 },
    { id: "proof-3", section: "proof", label: "Add three pieces of proof", points: 5, done: s.proofs.length >= 3 },
    { id: "proof-star", section: "proof", label: "Star the proof to lead with", points: 5, done: s.proofs.some((p) => p.starred) },
    { id: "github", section: "proof", label: "Link your GitHub", points: 5, done: !!s.githubHandle },
    { id: "status", section: "find", label: "Say what you're open to", points: 5, done: s.status.length > 0 },
    { id: "links", section: "find", label: "Add your site or X", points: 5, done: !!(s.site || s.x) },
    { id: "calendar", section: "find", label: "Add a calendar link", points: 5, done: !!s.calendarLink },
    { id: "sample", section: "write", label: "Paste something you wrote", points: 15, done: s.sampleCount > 0 },
    { id: "tone", section: "write", label: "Pick a tone", points: 5, done: !!s.tone },
    { id: "never", section: "write", label: "Add words you'd never say", points: 5, done: s.neverSay.length > 0 },
    { id: "cv", section: "cv", label: "Add your CV", points: 15, done: s.cvWords >= 150 },
    { id: "notes", section: "notes", label: "Tell it anything else", points: 10, done: s.notes.trim().length >= 20 },
  ];
}

export function sharpness(s: BrainSnapshot) {
  const items = sharpnessItems(s);
  const total = items.reduce((n, i) => n + i.points, 0);
  const got = items.filter((i) => i.done).reduce((n, i) => n + i.points, 0);
  const sections = {} as Record<SectionId, number>;
  for (const id of ["proof", "find", "write", "cv", "notes"] as SectionId[]) {
    const own = items.filter((i) => i.section === id);
    const max = own.reduce((n, i) => n + i.points, 0);
    sections[id] = max ? Math.round((own.filter((i) => i.done).reduce((n, i) => n + i.points, 0) / max) * 100) : 100;
  }
  return {
    percent: Math.round((got / total) * 100),
    sections,
    hints: items.filter((i) => !i.done).sort((a, b) => b.points - a.points),
  };
}
