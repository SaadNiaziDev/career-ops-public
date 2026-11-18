import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { ApplicationActivity } from "./application-activity-shared";

export function activityIdFor(sourceKey: string): string {
  const hash = createHash("sha256").update(sourceKey).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

function directory(root: string, n: string): string {
  if (!/^[1-9]\d{0,5}$/.test(n)) throw new Error("Invalid application number.");
  return path.join(root, "data", "application-activity", n);
}

export function readActivity(root: string, n: string): ApplicationActivity[] {
  const dir = directory(root, n);
  let files: string[];
  try { files = fs.readdirSync(dir); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  return files.filter((file) => /^[a-f0-9-]{36}\.json$/i.test(file)).map((file) => {
    const event = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as ApplicationActivity;
    if (event.n !== n || !event.id || !Number.isFinite(Date.parse(event.at))) throw new Error(`Unreadable activity record: ${file}`);
    return event;
  }).sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** Immutable files avoid lost updates when two tabs log different events at once. */
export function saveActivity(root: string, event: ApplicationActivity): ApplicationActivity {
  if (!/^[a-f0-9-]{36}$/i.test(event.id)) throw new Error("Invalid activity identifier.");
  const dir = directory(root, event.n);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${event.id}.json`);
  const tmp = path.join(dir, `.pending-${randomUUID()}`);
  try {
    fs.writeFileSync(tmp, `${JSON.stringify(event, null, 2)}\n`, { flag: "wx" });
    try { fs.linkSync(tmp, file); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = JSON.parse(fs.readFileSync(file, "utf8")) as ApplicationActivity;
      const { at: _oldAt, ...oldFields } = existing;
      const { at: _newAt, ...newFields } = event;
      if (JSON.stringify(oldFields) !== JSON.stringify(newFields)) throw new Error("This activity identifier was already used for a different record.");
      return existing;
    }
    return event;
  } finally { fs.rmSync(tmp, { force: true }); }
}
