import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import yaml from "js-yaml";
import { careerOpsRoot } from "@/lib/career-ops";
import { resolveCli, resolveDefaultCli } from "@/lib/clis";
import { atomicWrite } from "@/lib/core/safe-write";
import { authArgs, cliProbePassed } from "@/lib/onboarding/readiness-policy";
import { onboardingVerificationPending as readPending } from "@/lib/onboarding/readiness-state";

export { authArgs, cliProbePassed } from "@/lib/onboarding/readiness-policy";

export type ReadinessCheck = {
  id: string;
  label: string;
  ok: boolean;
  cause?: string;
  recovery?: string;
};

export type ReadinessResult = { ready: boolean; checks: ReadinessCheck[] };

const STATUS_FILE = ".career-ops-web/onboarding.json";

function fileCheck(root: string, rel: string, kind: "markdown" | "yaml"): ReadinessCheck {
  try {
    const content = fs.readFileSync(path.join(root, rel), "utf8");
    if (!content.trim()) throw new Error("file is empty");
    if (kind === "yaml" && !yaml.load(content)) throw new Error("file has no configuration");
    return { id: rel, label: `${rel} saved and readable`, ok: true };
  } catch (error) {
    return {
      id: rel,
      label: `${rel} is not ready`,
      ok: false,
      cause: error instanceof Error ? error.message : "read failed",
      recovery: rel === "cv.md"
        ? "Return to Add your CV and save it again."
        : `Open ${rel === "portals.yml" ? "Portals" : "Config"} and repair ${rel}, then retry verification.`,
    };
  }
}

function writableCheck(root: string, rel: string): ReadinessCheck {
  const dir = path.join(root, rel);
  const probe = path.join(dir, `.onboarding-${randomUUID()}.tmp`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(probe, "ok", "utf8");
    fs.unlinkSync(probe);
    return { id: `write:${rel}`, label: `${rel}/ is writable`, ok: true };
  } catch (error) {
    try { fs.unlinkSync(probe); } catch { /* probe was never created */ }
    return {
      id: `write:${rel}`,
      label: `${rel}/ is not writable`,
      ok: false,
      cause: error instanceof Error ? error.message : "write failed",
      recovery: `Give this user write access to ${dir}, then retry verification.`,
    };
  }
}

async function cliCheck(cliId: string): Promise<ReadinessCheck> {
  const selectedCli = cliId || resolveDefaultCli()?.cliId || "";
  if (!selectedCli) return { id: "cli", label: "No AI engine detected (optional)", ok: false, cause: "Discovery and tracker setup remain available.", recovery: "Install and sign in to Claude Code, Codex, or Cursor when you want AI evaluation." };
  const resolved = resolveCli(selectedCli);
  const args = authArgs(selectedCli);
  if (!resolved || !args) {
    return { id: "cli", label: "AI engine is unavailable (optional)", ok: false, cause: "The selected engine is not installed.", recovery: "Install Claude Code, Codex, or Cursor Agent when you want AI evaluation." };
  }
  const result = await new Promise<{ code: number | null; output: string }>((resolve) => {
    execFile(resolved.binPath, args, { cwd: careerOpsRoot(), timeout: 10_000 }, (error, stdout, stderr) => {
      const code = typeof (error as NodeJS.ErrnoException | null)?.code === "number" ? Number((error as NodeJS.ErrnoException).code) : error ? 1 : 0;
      resolve({ code, output: `${stdout || ""}\n${stderr || ""}`.trim() });
    });
  });
  const ok = cliProbePassed(result.code, result.output);
  return ok
    ? { id: "cli", label: `${resolved.spec.name} is signed in`, ok: true }
    : { id: "cli", label: `${resolved.spec.name} needs attention (optional)`, ok: false, cause: "The authentication probe failed.", recovery: `Sign in with ${resolved.spec.name} when you want AI evaluation.` };
}

async function browserCheck(): Promise<ReadinessCheck> {
  let browser: Awaited<ReturnType<typeof import("playwright-core").chromium.launch>> | undefined;
  try {
    const { chromium } = await import("playwright-core");
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent("<!doctype html><title>PDF check</title><main>Career-Ops PDF readiness check</main>");
    const pdf = await page.pdf({format: "A4", printBackground: true});
    const ok = pdf.byteLength > 500 && Buffer.from(pdf.subarray(0, 5)).toString("ascii") === "%PDF-";
    return ok
      ? { id: "pdf", label: "PDF rendered successfully", ok: true }
      : { id: "pdf", label: "PDF output is invalid", ok: false, recovery: "Check Chromium and Playwright installation, then retry." };
  } catch {
    return { id: "pdf", label: "PDF browser is unavailable", ok: false, cause: "Playwright could not launch Chromium.", recovery: "Run `npx playwright install chromium`, then retry verification." };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

export async function runReadiness(cliId: string): Promise<ReadinessResult> {
  const root = careerOpsRoot();
  const checks = [
    await cliCheck(cliId),
    fileCheck(root, "cv.md", "markdown"),
    fileCheck(root, "config/profile.yml", "yaml"),
    fileCheck(root, "portals.yml", "yaml"),
    fileCheck(root, "modes/_profile.md", "markdown"),
    ...["data", "output", "reports"].map((dir) => writableCheck(root, dir)),
    await browserCheck(),
  ];
  return { ready: checks.every((check) => check.ok || check.id === "cli"), checks };
}

export function writeOnboardingStatus(result: ReadinessResult | { ready: false; checks: [] }): void {
  atomicWrite(path.join(careerOpsRoot(), STATUS_FILE), JSON.stringify({ ...result, checkedAt: new Date().toISOString() }, null, 2));
}

export function onboardingVerificationPending(root = careerOpsRoot()): boolean {
  return readPending(root);
}

export function beginOnboarding(): void {
  if (onboardingVerificationPending()) return;
  writeOnboardingStatus({ ready: false, checks: [] });
}
