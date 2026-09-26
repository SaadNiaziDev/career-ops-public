import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { PROFILE_PATHS, validateProfilePatch, type ProfileFields } from "@/lib/profile-fields";
import { readBoundedJson } from "@/lib/core/request-bounds";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Merge-safe writer for config/profile.yml (a USER-LAYER file — DATA_CONTRACT:
// never clobber the user's archetypes/narrative/proof-points). On first create we
// seed from config/profile.example.yml; on an existing file we deep-merge ONLY the
// proposed keys, write atomically (temp + rename), and only ever via the confirm-
// gated setProfile action. The web orchestrates the real file — no parallel store.

type ProfilePatch = ProfileFields;

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** Deep-merge src onto dst (objects recurse; arrays/scalars replace). Non-mutating. */
function deepMerge(dst: unknown, src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(dst) ? { ...dst } : {};
  for (const [k, v] of Object.entries(src)) {
    out[k] = isObj(v) ? deepMerge(out[k], v) : v;
  }
  return out;
}

function patchToProfile(p: ProfilePatch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(p)) {
    const parts = PROFILE_PATHS[key as keyof ProfilePatch];
    if (!parts?.length) continue;
    let target = out;
    for (const part of parts.slice(0, -1)) {
      if (!isObj(target[part])) target[part] = {};
      target = target[part] as Record<string, unknown>;
    }
    target[parts.at(-1)!] = value;
  }
  if (p.compMin !== undefined && p.compMax !== undefined) {
    out.compensation = {...(out.compensation as object ?? {}), target_range: `${p.compMin}-${p.compMax}`};
  }
  return out;
}

/** Read-back of the same flat shape POST accepts, so Config can render the
 *  fields it will write. Anything else in profile.yml (archetypes, narrative)
 *  is deliberately not surfaced — this endpoint only owns what it writes. */
export async function GET() {
  const file = path.join(careerOpsRoot(), "config", "profile.yml");
  let doc: Record<string, unknown> = {};
  let exists = false;
  try {
    const parsed = yaml.load(fs.readFileSync(file, "utf8"));
    doc = isObj(parsed) ? parsed : {};
    exists = true;
  } catch (error) {
    if (!fs.existsSync(file)) return Response.json({ exists: false, profile: {} satisfies ProfilePatch });
    return Response.json({error: error instanceof Error ? error.message : "config/profile.yml could not be read."}, {status: 409});
  }

  if (!isObj(yaml.load(fs.readFileSync(file, "utf8")))) return Response.json({error: "config/profile.yml must contain a YAML mapping."}, {status:409});
  const profile: ProfilePatch = {};
  const customFields: string[] = [];
  for (const [key, parts] of Object.entries(PROFILE_PATHS)) {
    if (!parts.length) continue;
    let value: unknown = doc;
    for (const part of parts) value = isObj(value) ? value[part] : undefined;
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" || (Array.isArray(value) && value.every(v => typeof v === "string"))) {
      Object.assign(profile, {[key]: value});
    } else customFields.push(key);
  }

  return Response.json({ exists, profile, customFields });
}

export async function POST(req: Request) {
  let patch: ProfilePatch;
  try {
    patch = await readBoundedJson(req, 50_000) as ProfilePatch;
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  if (!isObj(patch)) return Response.json({error: "Expected profile fields"}, {status: 400});
  const invalid = validateProfilePatch(patch);
  if (invalid) return Response.json({error: invalid}, {status: 400});
  const proposed = patchToProfile(patch);
  if (Object.keys(proposed).length === 0) return Response.json({ error: "nothing to write" }, { status: 400 });

  const root = careerOpsRoot();
  const file = path.join(root, "config", "profile.yml");
  let base: Record<string, unknown> = {};
  let seeded = false;
  // DATA-LOSS GUARD (maintainer, bug-class #649/#704/#920/#958): distinguish
  // "no profile yet" (safe to seed from the example) from "profile EXISTS but is
  // malformed" (NEVER overwrite — that would silently destroy the user's data).
  if (!fs.existsSync(file)) {
    try {
      base = (yaml.load(fs.readFileSync(path.join(root, "config", "profile.example.yml"), "utf8")) as Record<string, unknown>) || {};
      seeded = Object.keys(base).length > 0;
    } catch {
      base = {};
    }
  } else {
    let parsed: unknown;
    try {
      parsed = yaml.load(fs.readFileSync(file, "utf8"));
    } catch {
      return Response.json({ error: "config/profile.yml exists but is not valid YAML — refusing to overwrite it." }, { status: 409 });
    }
    if (!isObj(parsed)) return Response.json({error: "Profile must be a YAML mapping; refusing to overwrite it."}, {status: 409});
    base = parsed;
  }

  const merged = deepMerge(base, proposed);
  try {
    // Back up the prior profile before the first normalized write (yaml.dump
    // reformats — comments are not preserved; the .bak is the safety net).
    atomicWriteWithBackup(file, yaml.dump(merged, { lineWidth: 100, noRefs: true }));
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "write failed" }, { status: 500 });
  }
  return Response.json({ ok: true, seeded });
}
