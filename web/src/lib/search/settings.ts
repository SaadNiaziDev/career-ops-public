import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot, templatePath } from "../career-ops-root.ts";
import { atomicWriteWithBackup } from "../core/safe-write.ts";
import { ATS_LABELS, BOARD_LABELS, detectAts, type Board } from "./sources.ts";

// What the free scan and AI search look for, stored in portals.yml.
// Every write keeps a timestamped backup of the previous file.

type Doc = Record<string, unknown>;
type CompanyEntry = { name?: string; careers_url?: string; api?: string; enabled?: boolean; [key: string]: unknown };
type BoardEntry = { name?: string; provider?: string; enabled?: boolean; [key: string]: unknown };

export type SearchCompany = { name: string; url: string; feed: string | null; enabled: boolean };
export type SearchBoard = { id: Board; label: string; enabled: boolean };
export type SearchSettings = {
  titles: string[];
  skipTitles: string[];
  alwaysAllow: string[];
  allow: string[];
  block: string[];
  maxAgeDays: number | null;
  boards: SearchBoard[];
  companies: SearchCompany[];
};
export type SearchSettingsPatch = Partial<Omit<SearchSettings, "boards" | "companies">> & { boards?: Partial<Record<Board, boolean>> };

const file = () => path.join(careerOpsRoot(), "portals.yml");
const obj = (v: unknown): Doc => (v && typeof v === "object" && !Array.isArray(v) ? (v as Doc) : {});
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : []);
const cleanList = (v: unknown): string[] => [...new Set(strings(v))].slice(0, 100);

function load(): Doc {
  for (const source of [file(), templatePath("portals.example.yml")]) {
    try { return obj(yaml.load(fs.readFileSync(source, "utf8"))); } catch { /* try the next source */ }
  }
  return {};
}

function save(doc: Doc) {
  atomicWriteWithBackup(file(), yaml.dump(doc, { lineWidth: 120, noRefs: true }));
}

export function readSearchSettings(): SearchSettings {
  const doc = load();
  const titles = obj(doc.title_filter);
  const location = obj(doc.location_filter);
  const boards = (Array.isArray(doc.job_boards) ? doc.job_boards : []) as BoardEntry[];
  const companies = (Array.isArray(doc.tracked_companies) ? doc.tracked_companies : []) as CompanyEntry[];
  return {
    titles: strings(titles.positive),
    skipTitles: strings(titles.negative),
    alwaysAllow: strings(location.always_allow),
    allow: strings(location.allow),
    block: strings(location.block),
    maxAgeDays: Number(doc.max_posting_age_days) > 0 ? Number(doc.max_posting_age_days) : null,
    boards: (Object.keys(BOARD_LABELS) as Board[]).map((id) => ({
      id,
      label: BOARD_LABELS[id],
      enabled: boards.some((b) => b.provider === id && b.enabled !== false),
    })),
    companies: companies.filter((c) => c.name).map((c) => {
      const url = c.api || c.careers_url || "";
      const feed = detectAts(c.api ?? "") ?? detectAts(c.careers_url ?? "");
      return { name: c.name!, url, feed: feed ? ATS_LABELS[feed.ats] : null, enabled: c.enabled !== false };
    }),
  };
}

export function updateSearchSettings(patch: SearchSettingsPatch): SearchSettings {
  const doc = load();
  const titles = obj(doc.title_filter);
  const location = obj(doc.location_filter);
  if (patch.titles) titles.positive = cleanList(patch.titles);
  if (patch.skipTitles) titles.negative = cleanList(patch.skipTitles);
  if (patch.alwaysAllow) location.always_allow = cleanList(patch.alwaysAllow);
  if (patch.allow) location.allow = cleanList(patch.allow);
  if (patch.block) location.block = cleanList(patch.block);
  doc.title_filter = titles;
  doc.location_filter = location;
  if (patch.maxAgeDays !== undefined) {
    if (patch.maxAgeDays && patch.maxAgeDays > 0) doc.max_posting_age_days = Math.round(patch.maxAgeDays);
    else delete doc.max_posting_age_days;
  }
  if (patch.boards) {
    const boards = (Array.isArray(doc.job_boards) ? doc.job_boards : []) as BoardEntry[];
    for (const [id, enabled] of Object.entries(patch.boards) as [Board, boolean][]) {
      if (!(id in BOARD_LABELS)) continue;
      const entry = boards.find((b) => b.provider === id);
      if (entry) entry.enabled = enabled;
      else boards.push({ name: BOARD_LABELS[id], provider: id, enabled });
    }
    doc.job_boards = boards;
  }
  save(doc);
  return readSearchSettings();
}

export function addCompany(name: string, url: string): SearchSettings {
  const cleanName = name.trim().slice(0, 120);
  let parsed: URL;
  try { parsed = new URL(url.trim()); } catch { throw new Error("Enter the company's careers page URL (https://…)."); }
  if (!cleanName) throw new Error("Enter the company name.");
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error("Enter an http(s) careers page URL.");
  const doc = load();
  const companies = (Array.isArray(doc.tracked_companies) ? doc.tracked_companies : []) as CompanyEntry[];
  if (companies.some((c) => c.name?.toLowerCase() === cleanName.toLowerCase())) throw new Error(`${cleanName} is already in your list.`);
  companies.push({ name: cleanName, careers_url: parsed.toString(), enabled: true });
  doc.tracked_companies = companies;
  save(doc);
  return readSearchSettings();
}

export function updateCompany(name: string, change: { enabled?: boolean; remove?: boolean }): SearchSettings {
  const doc = load();
  const companies = (Array.isArray(doc.tracked_companies) ? doc.tracked_companies : []) as CompanyEntry[];
  const index = companies.findIndex((c) => c.name === name);
  if (index < 0) throw new Error(`${name} is not in your list.`);
  if (change.remove) companies.splice(index, 1);
  else if (typeof change.enabled === "boolean") companies[index].enabled = change.enabled;
  doc.tracked_companies = companies;
  save(doc);
  return readSearchSettings();
}
