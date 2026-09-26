import { load as yamlLoad } from "js-yaml";

const FIELD_KEYS = {
  date: "Date", fecha: "Date", url: "URL", archetype: "Archetype",
  arquetipo: "Archetype", score: "Score", legitimacy: "Legitimacy",
  legitimidad: "Legitimacy", pdf: "PDF",
};

/** Parse report structure and machine data without accessing the filesystem. */
export function parseReportDocument(markdown) {
  const lines = String(markdown ?? "").split("\n");
  let cut = lines.findIndex((line, i) => i > 0 && (/^\s*-{3,}\s*$/.test(line) || /^##\s/.test(line)));
  if (cut < 0) cut = Math.min(lines.length, 10);
  const headerLines = lines.slice(0, cut);
  const bodyStart = /^\s*-{3,}\s*$/.test(lines[cut] ?? "") ? cut + 1 : cut;
  const body = lines.slice(bodyStart).join("\n").trim() || String(markdown ?? "");
  let title = null;
  let legitimacy = null;
  const fields = [];
  for (const line of headerLines) {
    const heading = line.match(/^#\s+(.+)/);
    if (heading) { title = heading[1].replace(/^Evaluat?i[oó]n:?\s*/i, "").trim(); continue; }
    const field = line.match(/^\s*\*\*(.+?):\*\*\s*(.*)$/);
    if (!field) continue;
    const label = FIELD_KEYS[field[1].trim().toLowerCase()];
    const value = field[2].trim();
    if (!label || !value) continue;
    if (label === "Legitimacy") legitimacy = value;
    fields.push({ label, value });
  }

  const fence = body.match(/##\s*Machine Summary\s*\n+```(?:yaml|yml|json)?\s*\n([\s\S]*?)\n```/i);
  let machineSummary = null;
  const warnings = [];
  if (fence) {
    try {
      const value = yamlLoad(fence[1]);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("expected a mapping");
      if (value.risk_summary === null) value.risk_summary = {};
      if (value.advertised_comp === null) value.advertised_comp = "";
      machineSummary = value;
    } catch (error) {
      warnings.push(`Machine Summary could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else warnings.push("Machine Summary is missing; this may be a legacy report.");

  const prose = fence ? body.replace(fence[0], "").trim() : body;
  const intro = [];
  const sections = [];
  let current = null;
  for (const line of prose.split("\n")) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      if (current) sections.push({ ...current, content: current.lines.join("\n").trim(), lines: undefined });
      const name = heading[1].trim();
      current = { heading: name, letter: name.match(/^(?:Block\s+)?([A-G])[).:\s]/i)?.[1]?.toUpperCase() ?? null, lines: [] };
    } else if (current) current.lines.push(line);
    else intro.push(line);
  }
  if (current) sections.push({ ...current, content: current.lines.join("\n").trim(), lines: undefined });
  return { title, fields, legitimacy, body, intro: intro.join("\n").trim(), sections, machineSummary, warnings };
}
