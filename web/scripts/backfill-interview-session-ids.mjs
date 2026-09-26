import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseApplications } from "../src/lib/tracker-table.mjs";
import { planSessionBackfill } from "../src/lib/interview-session-identity.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const sessionsDir = path.join(root, "interview-prep", "sessions");
const apply = process.argv.includes("--apply");
const trackerPath = path.join(root, "data", "applications.md");

const tracker = fs.readFileSync(trackerPath, "utf8");
const applications = parseApplications(tracker, root);
const files = fs.readdirSync(sessionsDir)
  .filter((file) => file.endsWith(".md") && file !== "README.md")
  .map((file) => {
    const content = fs.readFileSync(path.join(sessionsDir, file), "utf8");
    const frontmatter = Object.fromEntries((content.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "")
      .split("\n").map((line) => line.match(/^(\w+):\s*(.+)$/)).filter(Boolean).map((match) => [match[1], match[2].trim()]));
    return { file, content, frontmatter };
  });

const plan = planSessionBackfill(files, applications);
for (const item of plan) {
  const detail = item.trackerNum ? ` → #${item.trackerNum}` : item.candidates?.length ? ` → candidates #${item.candidates.join(", #")}` : "";
  console.log(`${apply && item.status === "matched" ? "BACKFILL" : item.status.toUpperCase()} ${item.file}${detail}`);
  if (!apply || item.status !== "matched") continue;
  const target = files.find((entry) => entry.file === item.file);
  const absolute = path.join(sessionsDir, item.file);
  const frontmatterMatch = target.content.match(/^(---\n)([\s\S]*?)(\n---)/);
  const updated = frontmatterMatch
    ? `${frontmatterMatch[1]}tracker_num: ${item.trackerNum}\n${frontmatterMatch[2]}${frontmatterMatch[3]}${target.content.slice(frontmatterMatch[0].length)}`
    : `---\ntracker_num: ${item.trackerNum}\n---\n\n${target.content}`;
  const backup = `${absolute}.bak-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  fs.copyFileSync(absolute, backup, fs.constants.COPYFILE_EXCL);
  const temp = `${absolute}.tmp-${process.pid}`;
  fs.writeFileSync(temp, updated, "utf8");
  fs.renameSync(temp, absolute);
}

const counts = plan.reduce((acc, item) => ({ ...acc, [item.status]: (acc[item.status] ?? 0) + 1 }), {});
console.log(`\n${apply ? "Applied" : "Dry run"}: ${counts.matched ?? 0} unambiguous, ${counts.ambiguous ?? 0} ambiguous, ${counts.unmatched ?? 0} unmatched, ${counts["already-tagged"] ?? 0} already tagged.`);
if (!apply && plan.some((item) => item.status === "matched")) console.log("Run with --apply to backfill unambiguous sessions. Ambiguous/unmatched files are never modified.");
