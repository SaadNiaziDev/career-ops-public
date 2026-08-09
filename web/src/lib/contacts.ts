import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { atomicWrite } from "@/lib/core/safe-write";

export type OutreachStatus = "not-contacted" | "messaged" | "replied" | "ghosted";
export type ContactType = "recruiter" | "hiring-manager" | "peer" | "interviewer" | "";

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
  contactType: ContactType;
  outreachStatus: OutreachStatus | "";
  lastTouch: string;
};

const HEADER =
  "date\ttracker#\tcompany\trole\tname\ttitle\tchannel\temail\tlinkedin\tverified\tsource\tnotes\tcontact_type\toutreach_status\tlast_touch";

function contactsPath(): string {
  return path.join(careerOpsRoot(), "data", "contacts.tsv");
}

function splitCols(line: string): string[] {
  return line.split("\t");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeLinkedin(url: string): string {
  return url.trim().toLowerCase().replace(/\/+$/, "");
}

function rowToLine(row: ContactRow): string {
  return [
    row.date,
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
    row.contactType,
    row.outreachStatus,
    row.lastTouch,
  ].join("\t");
}

function parseRow(c: string[]): ContactRow | null {
  if (c.length < 4) return null;
  const hasExtended = c.length >= 15;
  return {
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
    notes: hasExtended ? (c[11] ?? "") : c.slice(11).join("\t"),
    contactType: (hasExtended ? c[12] : "") as ContactType,
    outreachStatus: (hasExtended ? c[13] : "") as OutreachStatus | "",
    lastTouch: hasExtended ? (c[14] ?? "") : "",
  };
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
    const row = parseRow(c);
    if (row) rows.push(row);
  }
  return rows;
}

function writeContacts(rows: ContactRow[]): void {
  const p = contactsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const body = HEADER + "\n" + rows.map(rowToLine).join("\n") + "\n";
  atomicWrite(p, body);
}

function dedupIndex(rows: ContactRow[]): Map<string, number> {
  const idx = new Map<string, number>();
  rows.forEach((r, i) => {
    const email = normalizeEmail(r.email);
    const li = normalizeLinkedin(r.linkedin);
    if (email) idx.set(`email:${email}`, i);
    if (li.startsWith("http")) idx.set(`li:${li}`, i);
  });
  return idx;
}

export function appendContact(row: Omit<ContactRow, "date" | "contactType" | "outreachStatus" | "lastTouch"> & {
  date?: string;
  contactType?: ContactType;
  outreachStatus?: OutreachStatus | "";
  lastTouch?: string;
}): void {
  const rows = readContacts();
  const date = row.date ?? new Date().toISOString().slice(0, 10);
  const next: ContactRow = {
    date,
    trackerNum: row.trackerNum,
    company: row.company,
    role: row.role,
    name: row.name,
    title: row.title,
    channel: row.channel,
    email: row.email,
    linkedin: row.linkedin,
    verified: row.verified,
    source: row.source,
    notes: row.notes,
    contactType: row.contactType ?? "",
    outreachStatus: row.outreachStatus ?? "not-contacted",
    lastTouch: row.lastTouch ?? "",
  };

  const idx = dedupIndex(rows);
  const emailKey = normalizeEmail(next.email);
  const liKey = normalizeLinkedin(next.linkedin);
  const existing =
    (emailKey ? idx.get(`email:${emailKey}`) : undefined) ??
    (liKey.startsWith("http") ? idx.get(`li:${liKey}`) : undefined);

  if (existing !== undefined) {
    // Re-append is an enrich, not a replace: empty incoming fields must not
    // blank out data already on the row, and a default "not-contacted" must
    // not reset an outreach status that has already progressed.
    const prev = rows[existing];
    const merged: ContactRow = { ...prev };
    for (const key of Object.keys(next) as (keyof ContactRow)[]) {
      const val = next[key];
      if (val) (merged as Record<string, string>)[key] = val;
    }
    merged.date = prev.date || next.date;
    if (prev.outreachStatus && prev.outreachStatus !== "not-contacted") {
      merged.outreachStatus = prev.outreachStatus;
    }
    rows[existing] = merged;
  } else {
    rows.push(next);
  }
  writeContacts(rows);
}

export function updateContact(
  key: { email?: string; linkedin?: string; trackerNum?: string; name?: string },
  patch: Partial<Pick<ContactRow, "outreachStatus" | "lastTouch" | "contactType" | "notes" | "verified">>,
): boolean {
  const rows = readContacts();
  const emailKey = key.email ? normalizeEmail(key.email) : "";
  const liKey = key.linkedin ? normalizeLinkedin(key.linkedin) : "";
  let found = -1;
  rows.forEach((r, i) => {
    if (found !== -1) return;
    if (emailKey && normalizeEmail(r.email) === emailKey) found = i;
    else if (liKey && normalizeLinkedin(r.linkedin) === liKey) found = i;
    else if (key.trackerNum && key.name && r.trackerNum === key.trackerNum && r.name === key.name) found = i;
  });
  if (found === -1) return false;
  rows[found] = { ...rows[found], ...patch };
  writeContacts(rows);
  return true;
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
