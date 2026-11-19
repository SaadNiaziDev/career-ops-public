import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { careerOpsRoot } from "./career-ops-root.ts";

// Single local store: data/career-ops.db (Node's built-in SQLite, no native deps).
// Applications, evaluation reports, the job inbox, timeline events, email drafts
// and small settings all live here.

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
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

type Conn = { db: DatabaseSync; file: string };
const g = globalThis as unknown as { __careerOpsDb?: Conn };

export function dbFile(root = careerOpsRoot()): string {
  return path.join(root, "data", "career-ops.db");
}

/** The app database, opened once per process. */
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
    conn = g.__careerOpsDb = { db: handle, file };
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
