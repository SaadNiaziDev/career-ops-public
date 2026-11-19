import path from "node:path";

/**
 * The career-ops "home" holding cv.md, data/, reports/. The web app lives inside
 * the checkout, so the home is its parent; CAREER_OPS_ROOT overrides it.
 */
export function careerOpsRoot(): string {
  const env = process.env.CAREER_OPS_ROOT?.trim();
  if (env) return env;
  return path.resolve(process.cwd(), "..");
}

/**
 * Absolute path to a CV engine script in web/engine/ (run as a child process).
 * Built at runtime so the bundler never tries to trace it as an import.
 */
export function engineScript(nameNoExt: string): string {
  return path.join(process.cwd(), "engine", `${nameNoExt}.mjs`);
}

/** A starter file shipped with the app (web/engine/templates/). */
export function templatePath(name: string): string {
  return path.join(process.cwd(), "engine", "templates", name);
}
