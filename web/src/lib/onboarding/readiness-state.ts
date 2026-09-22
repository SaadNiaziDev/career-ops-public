import fs from "node:fs";
import path from "node:path";

export function onboardingVerificationPending(root: string): boolean {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, ".career-ops-web", "onboarding.json"), "utf8")).ready !== true;
  } catch {
    return false;
  }
}
