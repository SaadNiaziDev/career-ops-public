import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { careerOpsRoot } from "./career-ops-root.ts";
import { parseApplications } from "./tracker-table.mjs";
import { parsePipeline } from "./core/pipeline-entry.mjs";
import { normalizeVacancyUrl } from "./vacancy-identity.ts";

// Single local store: data/career-ops.db (Node's built-in SQLite, no native deps).
// The UI reads and writes only here. Until the CLI workers return JSON (phase 3),
// they still write applications.md / reports/ / pipeline.md, so `sync()` imports
// any row whose file content changed since the last import. Rows edited in the UI
// keep their DB value until the file row itself changes again.

const SCHEMA = `
CREATE TABLE IF NOT EXISTS applications (
  n INTEGER PRIMARY KEY, date TEXT NOT NULL DEFAULT '', company TEXT NOT NULL DEFAULT '', via TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '', location TEXT, score TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT '',
  pdf TEXT NOT NULL DEFAULT '', report TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '',
  deleted INTEGER NOT NULL DEFAULT 0, src_hash TEXT, updated_at TEXT
);
CREATE TABLE IF NOT EXISTS reports (
  n INTEGER PRIMARY KEY, file TEXT NOT NULL, content TEXT NOT NULL, url TEXT, location TEXT, src_hash TEXT
);
CREATE TABLE IF NOT EXISTS jobs (
  key TEXT PRIMARY KEY, url TEXT NOT NULL, company TEXT NOT NULL, role TEXT NOT NULL, location TEXT, compensation TEXT,
  posted_at TEXT, fit_score REAL, done INTEGER NOT NULL DEFAULT 0, removed INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL DEFAULT 0, src_hash TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS seen (
  key TEXT PRIMARY KEY, url TEXT NOT NULL, first_seen TEXT NOT NULL, source TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, n INTEGER NOT NULL, kind TEXT NOT NULL, at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_n ON events(n);
CREATE TABLE IF NOT EXISTS outreach (
  id TEXT PRIMARY KEY, tracker_num TEXT, updated_at TEXT NOT NULL, data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_state (source TEXT PRIMARY KEY, sig TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

type Conn = { db: DatabaseSync; file: string; lastSync: number };
const g = globalThis as unknown as { __careerOpsDb?: Conn };

export function dbFile(root = careerOpsRoot()): string {
  return path.join(root, "data", "career-ops.db");
}

/** Open (once per process) and sync legacy files at most every 2s. */
export function db(): DatabaseSync {
  const file = dbFile();
  let conn = g.__careerOpsDb;
  if (!conn || conn.file !== file) {
    conn?.db.close();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const handle = new DatabaseSync(file);
    handle.exec("PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;");
    handle.exec(SCHEMA);
    migrate(handle);
    conn = g.__careerOpsDb = { db: handle, file, lastSync: 0 };
  }
  if (Date.now() - conn.lastSync > 2_000) {
    conn.lastSync = Date.now();
    syncFromFiles(conn.db, careerOpsRoot());
  }
  return conn.db;
}

/** Additive column migrations for databases created by earlier versions. */
function migrate(d: DatabaseSync) {
  const cols = new Set((d.prepare("PRAGMA table_info(jobs)").all() as { name: string }[]).map((c) => c.name));
  for (const [name, type] of [["source", "TEXT"], ["why", "TEXT"], ["kind", "TEXT"]] as const) {
    if (!cols.has(name)) d.exec(`ALTER TABLE jobs ADD COLUMN ${name} ${type}`);
  }
}

export function getKv(key: string): string | null {
  return (db().prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined)?.value ?? null;
}

export function setKv(key: string, value: string) {
  db().prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

export function tx<T>(fn: () => T): T {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    d.exec("COMMIT");
    return out;
  } catch (error) {
    d.exec("ROLLBACK");
    throw error;
  }
}

const hash = (value: unknown) => createHash("sha1").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");

function readText(file: string): string | null {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

function signature(target: string): string | null {
  try {
    const st = fs.statSync(target);
    if (!st.isDirectory()) return `${st.mtimeMs}:${st.size}`;
    return fs.readdirSync(target, { recursive: true }).map(String).sort()
      .map((name) => { const s = fs.statSync(path.join(target, name)); return `${name}:${s.mtimeMs}:${s.size}`; }).join("|");
  } catch {
    return null;
  }
}

/** Run `fn` only when the source's signature changed since the last import. */
function changed(d: DatabaseSync, source: string, target: string, fn: () => void) {
  const sig = signature(target);
  if (sig === null) return;
  const prev = d.prepare("SELECT sig FROM sync_state WHERE source = ?").get(source) as { sig: string } | undefined;
  if (prev?.sig === sig) return;
  d.exec("BEGIN IMMEDIATE");
  try {
    fn();
    d.prepare("INSERT INTO sync_state (source, sig) VALUES (?, ?) ON CONFLICT(source) DO UPDATE SET sig = excluded.sig").run(source, sig);
    d.exec("COMMIT");
  } catch (error) {
    d.exec("ROLLBACK");
    console.error(`[db] import of ${source} failed:`, error);
  }
}

export function syncFromFiles(d: DatabaseSync, root: string) {
  const file = (rel: string) => path.join(root, ...rel.split("/"));
  const now = new Date().toISOString();

  changed(d, "applications.md", file("data/applications.md"), () => {
    const md = readText(file("data/applications.md")) ?? "";
    const get = d.prepare("SELECT src_hash FROM applications WHERE n = ?");
    const upsert = d.prepare(`INSERT INTO applications (n, date, company, via, role, location, score, status, pdf, report, notes, src_hash, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(n) DO UPDATE SET date=excluded.date, company=excluded.company, via=excluded.via, role=excluded.role,
        location=excluded.location, score=excluded.score, status=excluded.status, pdf=excluded.pdf, report=excluded.report,
        notes=excluded.notes, src_hash=excluded.src_hash, updated_at=excluded.updated_at`);
    for (const row of parseApplications(md, root)) {
      const n = Number.parseInt(row.n, 10);
      const h = hash(row);
      const prev = get.get(n) as { src_hash: string | null } | undefined;
      if (prev?.src_hash === h) continue;
      upsert.run(n, row.date, row.company, row.via ?? "", row.role, row.location ?? null, row.score, row.status, row.pdf, row.report, row.notes, h, now);
    }
  });

  changed(d, "reports", file("reports"), () => {
    let names: string[] = [];
    try { names = fs.readdirSync(file("reports")); } catch { return; }
    const get = d.prepare("SELECT src_hash FROM reports WHERE n = ?");
    const upsert = d.prepare(`INSERT INTO reports (n, file, content, url, location, src_hash) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(n) DO UPDATE SET file=excluded.file, content=excluded.content, url=excluded.url, location=excluded.location, src_hash=excluded.src_hash`);
    for (const name of names.sort()) {
      if (!name.endsWith(".md") || /-RESERVED\.md$/i.test(name)) continue;
      const n = Number.parseInt(name, 10);
      if (!Number.isFinite(n)) continue;
      const content = readText(path.join(file("reports"), name));
      if (!content) continue;
      const h = hash(content);
      if ((get.get(n) as { src_hash: string } | undefined)?.src_hash === h) continue;
      const location = content.match(/^\|\s*\*{0,2}Remote\*{0,2}\s*\|\s*(.+?)\s*\|\s*$/im)?.[1]?.replace(/[*`]/g, "").trim() || null;
      const url = content.match(/^\*\*URL:\*\*\s*<?(https?:\/\/[^\s>]+)>?/im)?.[1] ?? null;
      upsert.run(n, name, content, url, location, h);
    }
  });

  changed(d, "scan-history.tsv", file("data/scan-history.tsv"), () => {
    const tsv = readText(file("data/scan-history.tsv")) ?? "";
    const insert = d.prepare("INSERT OR IGNORE INTO seen (key, url, first_seen, source) VALUES (?, ?, ?, ?)");
    for (const [i, line] of tsv.split("\n").entries()) {
      if (!line || (i === 0 && line.startsWith("url\t"))) continue;
      const [url, firstSeen, source] = line.split("\t");
      if (!url || !/^\d{4}-\d{2}-\d{2}$/.test(firstSeen ?? "")) continue;
      insert.run(normalizeVacancyUrl(url) ?? url, url, firstSeen, source ?? "");
    }
  });

  changed(d, "pipeline.md", file("data/pipeline.md"), () => {
    const md = readText(file("data/pipeline.md")) ?? "";
    const get = d.prepare("SELECT src_hash, location, fit_score FROM jobs WHERE key = ?");
    const upsert = d.prepare(`INSERT INTO jobs (key, url, company, role, location, compensation, posted_at, fit_score, done, seq, src_hash, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET url=excluded.url, company=excluded.company, role=excluded.role, location=excluded.location,
        compensation=excluded.compensation, posted_at=excluded.posted_at, fit_score=excluded.fit_score, done=excluded.done, src_hash=excluded.src_hash`);
    const seenKeys = new Set<string>();
    for (const [seq, e] of parsePipeline(md).entries.entries()) {
      if (e.reportLinked || !e.url || !e.company || !e.role) continue;
      const key = normalizeVacancyUrl(e.url) ?? e.url;
      const row = { url: e.url, company: e.company, role: e.role, location: e.location || null, compensation: e.compensation || null, postedAt: e.postedAt ?? null, fit: e.fitScore ?? null, done: e.done ? 1 : 0 };
      const h = hash(row);
      const prev = get.get(key) as { src_hash: string; location: string | null; fit_score: number | null } | undefined;
      // Same posting twice in the file: keep the richer row (fit score / location).
      if (seenKeys.has(key) && prev && (prev.fit_score != null ? 2 : 0) + (prev.location ? 1 : 0) >= (row.fit != null ? 2 : 0) + (row.location ? 1 : 0)) continue;
      seenKeys.add(key);
      if (prev?.src_hash === h) continue;
      upsert.run(key, row.url, row.company, row.role, row.location, row.compensation, row.postedAt, row.fit, row.done, seq, h, now);
    }
  });

  changed(d, "stage-history", file("data/application-stage-history.json"), () => {
    let rows: unknown;
    try { rows = JSON.parse(readText(file("data/application-stage-history.json")) ?? "[]"); } catch { return; }
    if (!Array.isArray(rows)) return;
    const insert = d.prepare("INSERT OR IGNORE INTO events (id, n, kind, at, data) VALUES (?, ?, 'status', ?, ?)");
    for (const r of rows as { n?: unknown; from?: unknown; to?: unknown; at?: unknown }[]) {
      if (typeof r?.n !== "string" || !/^\d+$/.test(r.n) || typeof r.at !== "string" || Number.isNaN(Date.parse(r.at))) continue;
      insert.run(`stage:${r.n}:${r.at}:${String(r.to)}`, Number(r.n), r.at, JSON.stringify({ from: String(r.from ?? ""), to: String(r.to ?? "") }));
    }
  });

  changed(d, "application-activity", file("data/application-activity"), () => {
    const dir = file("data/application-activity");
    const insert = d.prepare("INSERT OR IGNORE INTO events (id, n, kind, at, data) VALUES (?, ?, ?, ?, ?)");
    for (const n of fs.readdirSync(dir)) {
      if (!/^\d+$/.test(n)) continue;
      for (const name of fs.readdirSync(path.join(dir, n))) {
        if (!/^[a-f0-9-]{36}\.json$/i.test(name)) continue;
        try {
          const ev = JSON.parse(readText(path.join(dir, n, name)) ?? "") as { id: string; n: string; kind: string; at: string };
          if (ev.n !== n || !ev.id || Number.isNaN(Date.parse(ev.at))) continue;
          insert.run(ev.id, Number(n), ev.kind, ev.at, JSON.stringify(ev));
        } catch { /* skip unreadable record */ }
      }
    }
  });

  changed(d, "follow-ups.md", file("data/follow-ups.md"), () => {
    const md = readText(file("data/follow-ups.md")) ?? "";
    const insert = d.prepare("INSERT OR IGNORE INTO events (id, n, kind, at, data) VALUES (?, ?, 'followup', ?, ?)");
    for (const line of md.split(/\r?\n/)) {
      const m = line.match(/^- (\d{4}-\d{2}-\d{2}) · #(\d+) /);
      if (!m) continue;
      const id = `legacy-followup:${hash(line).slice(0, 16)}`;
      insert.run(id, Number(m[2]), m[1], JSON.stringify({ id, n: m[2], kind: "followup", at: m[1], channel: "unknown", note: line.replace(/^- /, ""), legacy: true }));
    }
  });

  changed(d, "outreach", file("data/outreach"), () => {
    const dir = file("data/outreach");
    const insert = d.prepare("INSERT OR IGNORE INTO outreach (id, tracker_num, updated_at, data) VALUES (?, ?, ?, ?)");
    for (const name of fs.readdirSync(dir)) {
      if (!name.endsWith(".json")) continue;
      try {
        const rec = JSON.parse(readText(path.join(dir, name)) ?? "") as { id?: string; trackerNum?: string; updatedAt?: string };
        if (!rec.id) continue;
        insert.run(rec.id, rec.trackerNum ?? null, rec.updatedAt ?? now, JSON.stringify(rec));
      } catch { /* skip unreadable record */ }
    }
  });
}
