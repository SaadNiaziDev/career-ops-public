const SECTION = /^\s*##\s+(.+?)\s*$/;
const ITEM = /^(\s*-\s*\[([ xX])\]\s*)(.*)$/;
const TAG = /^[\w-]+\s*:/i;

function splitColumns(value) {
  const columns = [];
  let current = "";
  let escaped = false;
  for (const char of value) {
    if (escaped) {
      current += `\\${char}`;
      escaped = false;
    } else if (char === "\\") escaped = true;
    else if (char === "|") {
      columns.push(current);
      current = "";
    } else current += char;
  }
  if (escaped) current += "\\";
  columns.push(current);
  return columns;
}

function unescapeField(value) {
  return value.replace(/\\([|\\[\]])/g, "$1").trim();
}

function sectionType(name) {
  if (/^(pending|pendientes)$/i.test(name.trim())) return "pending";
  if (/^(processed|procesadas)$/i.test(name.trim())) return "processed";
  return "other";
}

function urlColumn(columns) {
  const first = unescapeField(columns[0] ?? "");
  if (/^https?:\/\//i.test(first)) return 0;
  const second = unescapeField(columns[1] ?? "");
  if (/^https?:\/\//i.test(second)) return 1;
  const match = first.match(/https?:\/\/[^\s)]+/i);
  return match ? { index: 0, url: match[0] } : -1;
}

/** Parse pending and completed checkbox rows while retaining the original row and unknown fields. */
export function parsePipeline(text) {
  const lines = String(text ?? "").split(/\r?\n/);
  const sections = [];
  const entries = [];
  let current = { type: "other", name: "", lineIndex: -1 };
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(SECTION);
    if (heading) {
      if (current.lineIndex >= 0) current.endIndex = index;
      current = { type: sectionType(heading[1]), name: heading[1], lineIndex: index };
      sections.push(current);
      continue;
    }
    const item = lines[index].match(ITEM);
    if (!item) continue;
    const columns = splitColumns(item[3]);
    const urlAt = urlColumn(columns);
    if (urlAt === -1) continue;
    const urlIndex = typeof urlAt === "number" ? urlAt : urlAt.index;
    const rawUrl = typeof urlAt === "number" ? columns[urlAt] : urlAt.url;
    const url = unescapeField(rawUrl);
    const fields = columns.map(unescapeField);
    const reportLinked = urlIndex !== 0;
    const companyIndex = reportLinked ? 2 : 1;
    const roleIndex = reportLinked ? 3 : 2;
    const trailing = fields.slice(roleIndex + 1);
    const positional = reportLinked ? [] : trailing.slice(0, 2).map((field) => TAG.test(field) ? "" : field);
    const annotations = reportLinked
      ? trailing.filter(Boolean)
      : trailing.filter((field, index) => Boolean(field) && (TAG.test(field) || index >= 2));
    const location = positional[0] || "";
    const compensation = positional[1] || "";
    const fit = [...positional, ...annotations].find((field) => /^fit\s*:/i.test(field));
    const posted = [...positional, ...annotations].find((field) => /^posted\s*:/i.test(field));
    const entry = {
      lineIndex: index,
      section: current.type,
      sectionName: current.name,
      done: item[2].toLowerCase() === "x",
      url,
      company: fields[companyIndex] || "",
      role: fields[roleIndex] || "",
      location,
      compensation,
      annotations,
      fitScore: fit ? Number(fit.split(":").slice(1).join(":").trim()) : undefined,
      postedAt: posted?.split(":").slice(1).join(":").trim(),
      columns,
      raw: lines[index],
      originalDone: item[2].toLowerCase() === "x",
      prefix: item[1],
      reportLinked,
      report: reportLinked ? fields[0] : undefined,
    };
    entry.fitScore = Number.isFinite(entry.fitScore) ? entry.fitScore : undefined;
    entries.push(entry);
    const activeSection = sections.at(-1);
    if (activeSection) (activeSection.entries ??= []).push(entry);
  }
  if (current.lineIndex >= 0 && current.endIndex === undefined) current.endIndex = lines.length;
  return { entries, sections, lines };
}

/** Format a new pipeline row from canonical fields; unknown annotations are retained verbatim. */
export function formatPipelineEntry(entry) {
  if (entry.raw !== undefined && entry.done === entry.originalDone) return entry.raw;
  const done = Boolean(entry.done);
  const company = entry.company ?? "";
  const role = entry.role ?? "";
  const columns = entry.report
    ? [entry.report, entry.url ?? "", company, role]
    : [entry.url ?? "", company, role];
  const location = entry.location ?? "";
  const compensation = entry.compensation ?? "";
  if (!entry.report) {
    if (compensation) columns.push(location, compensation);
    else if (location) columns.push(location);
  }
  for (const annotation of entry.annotations ?? []) if (annotation) columns.push(annotation);
  const rendered = columns.map((field, index) => {
    const value = String(field).replace(/[\r\n]+/g, " ");
    if (entry.report && index === 0) return value;
    return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|").replace(/([\[\]])/g, "\\$1");
  });
  return `- [${done ? "x" : " "}] ${rendered.join(" | ")}`;
}

/** Change only the checkbox marker for exact matching URLs; all other bytes stay intact. */
export function updateEntryState(text, selector, done = true) {
  const parsed = parsePipeline(text);
  const wanted = String(selector ?? "").trim();
  const indexes = parsed.entries.filter((entry) => entry.url === wanted).map((entry) => entry.lineIndex);
  if (!indexes.length) return { content: String(text ?? ""), updated: 0 };
  const newline = String(text).includes("\r\n") ? "\r\n" : "\n";
  const lines = parsed.lines;
  for (const index of indexes) {
    const match = lines[index].match(ITEM);
    if (!match) continue;
    lines[index] = `${match[1].replace(/[ xX](?=\]\s*)/, done ? "x" : " ")}${match[3]}`;
  }
  return { content: lines.join(newline), updated: indexes.length };
}
