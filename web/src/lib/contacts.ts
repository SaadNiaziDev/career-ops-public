import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export type ContactRow = {
  date: string;
  trackerNum: string;
  company: string;
  role: string;
  name: string;
  title: string;
  channel: string;
  email: string;
  linkedin: string;
  verified: string;
  source: string;
  notes: string;
};

const HEADER = "date\ttracker#\tcompany\trole\tname\ttitle\tchannel\temail\tlinkedin\tverified\tsource\tnotes";

function contactsPath(): string {
  return path.join(careerOpsRoot(), "data", "contacts.tsv");
}

function splitCols(line: string): string[] {
  return line.split("\t");
}

export function readContacts(): ContactRow[] {
  let raw = "";
  try {
    raw = fs.readFileSync(contactsPath(), "utf8");
  } catch {
    return [];
  }
  const lines = raw.split("\n").filter(Boolean);
  const rows: ContactRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.startsWith("date\t")) continue;
    const c = splitCols(line);
    if (c.length < 4) continue;
    rows.push({
      date: c[0] ?? "",
      trackerNum: c[1] ?? "",
      company: c[2] ?? "",
      role: c[3] ?? "",
      name: c[4] ?? "",
      title: c[5] ?? "",
      channel: c[6] ?? "",
      email: c[7] ?? "",
      linkedin: c[8] ?? "",
      verified: c[9] ?? "",
      source: c[10] ?? "",
      notes: c.slice(11).join("\t") ?? "",
    });
  }
  return rows;
}

export function appendContact(row: Omit<ContactRow, "date"> & { date?: string }): void {
  const p = contactsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const date = row.date ?? new Date().toISOString().slice(0, 10);
  const line = [
    date,
    row.trackerNum,
    row.company,
    row.role,
    row.name,
    row.title,
    row.channel,
    row.email,
    row.linkedin,
    row.verified,
    row.source,
    row.notes.replace(/\t/g, " "),
  ].join("\t");
  let existing = "";
  try {
    existing = fs.readFileSync(p, "utf8");
  } catch {
    existing = HEADER + "\n";
  }
  if (!existing.trim()) existing = HEADER + "\n";
  if (!existing.startsWith("date\t")) existing = HEADER + "\n" + existing;
  atomicWrite(p, existing.replace(/\n?$/, "\n") + line + "\n");
}

export function draftsDir(): string {
  return path.join(careerOpsRoot(), "data", "drafts");
}

export type DraftKind = "cover" | "email" | "contacto";

export function draftPath(trackerNum: string, kind: DraftKind): string {
  return path.join(draftsDir(), `${trackerNum}-${kind}.md`);
}

export function readDraft(trackerNum: string, kind: DraftKind): string | null {
  try {
    return fs.readFileSync(draftPath(trackerNum, kind), "utf8");
  } catch {
    return null;
  }
}

export function listDrafts(trackerNum?: string): { trackerNum: string; kind: DraftKind; mtime: number }[] {
  const dir = draftsDir();
  let files: string[] = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith(".md"));
  } catch {
    return [];
  }
  const out: { trackerNum: string; kind: DraftKind; mtime: number }[] = [];
  for (const f of files) {
    const m = f.match(/^(\d+)-(cover|email|contacto)\.md$/);
    if (!m) continue;
    if (trackerNum && m[1] !== trackerNum) continue;
    const kind = m[2] as DraftKind;
    let mtime = 0;
    try {
      mtime = fs.statSync(path.join(dir, f)).mtimeMs;
    } catch {
      /* ignore */
    }
    out.push({ trackerNum: m[1], kind, mtime });
  }
  return out.sort((a, b) => b.mtime - a.mtime);
}
