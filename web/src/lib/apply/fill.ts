// Fill a live application form with reviewed answers and attach the CV. Never submits.
import type { ApplyField } from "./extract";
import { verifyFill, type ApplyIssue } from "./diagnose";
import { cssAttr } from "./browser";
import { getSession } from "./session";

export type FillStep = { fieldId: string; label: string; ok: boolean; thumb?: string };

/** True for a file field that wants the candidate's résumé/CV (vs. cover letter,
 *  portfolio, or a generic attachment we leave for the user). */
export function isResumeField(f: ApplyField): boolean {
  return f.type === "file" && /resume|résumé|\bcv\b|curriculum|lebenslauf|currículum/i.test(f.label || "");
}

/** Fill the real form with verified answers, screenshotting after each field.
 *  Attaches the tailored CV PDF to résumé/CV file fields (cvPath). NEVER clicks a
 *  submit/apply control — only fills/selects/checks/attaches. */
export async function fillSession(
  id: string,
  answers: Record<string, string>,
  fieldsMeta: ApplyField[],
  cvPath?: string,
): Promise<{ steps: FillStep[]; navigated: boolean; issues: ApplyIssue[] }> {
  const s = getSession(id);
  if (!s) throw new Error("apply session not found (it may have expired)");
  const byId = new Map(fieldsMeta.map((f) => [f.id, f]));
  const steps: FillStep[] = [];
  // Belt-and-suspenders: if filling ever navigates the page (i.e. something got
  // submitted), the URL path changes. We never submit by construction, but we
  // report it so the caller can flag it instead of silently "succeeding".
  const startPath = (() => {
    try {
      return new URL(s.frame.url()).pathname;
    } catch {
      return s.frame.url();
    }
  })();

  const shoot = async () => {
    try {
      const buf = await s.page.screenshot({ type: "jpeg", quality: 38 });
      return `data:image/jpeg;base64,${buf.toString("base64")}`;
    } catch {
      return undefined;
    }
  };

  // 1) Attach the tailored CV to every résumé/CV file field (even with no text
  //    answer). The real <input type=file> was tagged data-co-field at extract
  //    time; setInputFiles works even when the ATS visually hides it behind a
  //    dropzone. Other file fields (cover letter, portfolio) are left to the user.
  if (cvPath) {
    for (const meta of fieldsMeta) {
      if (!isResumeField(meta)) continue;
      let ok = false;
      try {
        await s.frame.locator(`[data-co-field="${cssAttr(meta.id)}"]`).first().setInputFiles(cvPath);
        ok = true;
      } catch {
        // fallback: any file input inside the same field container
        try {
          await s.frame.locator(`input[type=file]`).first().setInputFiles(cvPath);
          ok = true;
        } catch {
          ok = false;
        }
      }
      steps.push({ fieldId: meta.id, label: `${meta.label || "Resume"} (CV attached)`, ok, thumb: await shoot() });
    }
  }

  for (const [fid, raw] of Object.entries(answers)) {
    const meta = byId.get(fid);
    const value = (raw ?? "").toString();
    if (!meta || value === "") continue;
    if (meta.type === "file") continue; // handled above (CV) — never auto-fill other uploads
    // Defense-in-depth: NEVER auto-tick a legal consent/agreement checkbox — the
    // human must affirmatively accept. (The planner already flags these
    // needs_confirmation; this guarantees it even if it slips.)
    if (meta.type === "checkbox" && /\b(i (have )?read|i agree|i consent|i accept|consent to|privacy notice|terms|gdpr|data protection)\b/i.test(meta.label || "")) {
      steps.push({ fieldId: fid, label: `${meta.label} — you confirm`, ok: false, thumb: undefined });
      continue;
    }
    let ok = false;
    let gaveUp = false;
    try {
      const loc = s.frame.locator(`[data-co-field="${cssAttr(fid)}"]`).first();
      if (meta.combobox) {
        // react-select: open, type to filter, CLICK the matching option. We never
        // press Enter — in a form, Enter can submit. Clicking an option can't.
        await loc.scrollIntoViewIfNeeded().catch(() => {});
        await loc.click();
        await s.page.waitForTimeout(150);
        await loc.pressSequentially(value, { delay: 15 }).catch(async () => {
          await s.page.keyboard.type(value);
        });
        await s.page.waitForTimeout(300);
        const esc = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const menu = '.select__menu .select__option, .select__menu-list [role="option"], [class*="menu" i] [role="option"]';
        const exact = s.frame.locator(menu).filter({ hasText: new RegExp(`^\\s*${esc}\\s*$`, "i") }).first();
        if (await exact.count()) {
          await exact.click();
        } else {
          // fall back to the first option that contains the typed text; else give
          // up (Escape closes the menu) — leave it for the human, never submit.
          const partial = s.frame.locator(menu).filter({ hasText: new RegExp(esc, "i") }).first();
          if (await partial.count()) await partial.click();
          else {
            await s.page.keyboard.press("Escape").catch(() => {});
            gaveUp = true;
          }
        }
      } else if (meta.type === "select") {
        await loc.selectOption({ label: value }).catch(async () => {
          await loc.selectOption(value);
        });
      } else if (meta.type === "checkbox") {
        const want = ["true", "1", "yes", "on", "checked"].includes(value.toLowerCase());
        let done = false;
        try {
          await loc.setChecked(want, { timeout: 3000 });
          done = true;
        } catch {
          // custom-styled checkbox with a hidden real <input> → click its label
          // (native toggle + React onChange) or force as a last resort.
          if ((await loc.isChecked().catch(() => false)) === want) {
            done = true;
          } else {
            const cid = await loc.getAttribute("id").catch(() => null);
            const lab = cid ? s.frame.locator(`label[for="${cssAttr(cid)}"]`).first() : null;
            if (lab && (await lab.count())) {
              await lab.click().catch(() => {});
              done = true;
            } else {
              try {
                await loc.check({ force: true });
                done = true;
              } catch {
                /* leave for the user */
              }
            }
          }
        }
        gaveUp = !done;
      } else if (meta.type === "radio") {
        const r = s.frame.locator(`[data-co-field="${cssAttr(fid)}"][data-co-option="${cssAttr(value)}"]`).first();
        await r.check({ timeout: 3000 }).catch(async () => {
          await r.check({ force: true }).catch(async () => {
            const rid = await r.getAttribute("id").catch(() => null);
            if (rid) await s.frame.locator(`label[for="${cssAttr(rid)}"]`).first().click().catch(() => { gaveUp = true; });
            else gaveUp = true;
          });
        });
      } else {
        await loc.fill(value);
      }
      ok = !gaveUp;
    } catch {
      ok = false;
    }
    steps.push({ fieldId: fid, label: meta.label, ok, thumb: await shoot() });
  }
  const endPath = (() => {
    try {
      return new URL(s.frame.url()).pathname;
    } catch {
      return s.frame.url();
    }
  })();
  // Read the real form back: did every answer actually land? any validation
  // error? — so we warn the user about silent divergence before the handoff.
  const issues = await verifyFill(s.frame, fieldsMeta, answers).catch(() => [] as ApplyIssue[]);
  return { steps, navigated: endPath !== startPath, issues };
}

/** Hand the real (now pre-filled) form to the HUMAN to review + submit. The
 *  window was kept OFF-SCREEN during fill, so bringToFront alone wouldn't make it
 *  visible — we reposition it on-screen via CDP first. We never submit. */
export async function handoffSession(id: string): Promise<void> {
  const s = getSession(id);
  if (!s) throw new Error("apply session not found");
  try {
    const cdp = await s.context.newCDPSession(s.page);
    const { windowId } = (await cdp.send("Browser.getWindowForTarget")) as { windowId: number };
    await cdp.send("Browser.setWindowBounds", {
      windowId,
      bounds: { left: 80, top: 60, width: 1280, height: 920, windowState: "normal" },
    });
    await cdp.detach().catch(() => {});
  } catch {
    /* CDP unavailable → bringToFront still raises it */
  }
  await s.page.bringToFront().catch(() => {});
}
