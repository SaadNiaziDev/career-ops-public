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

/** Absolute path to a root script, assembled at runtime so the bundler never traces it. */
export function rootScript(nameNoExt: string): string {
  return path.join(careerOpsRoot(), `${nameNoExt}.mjs`);
}
