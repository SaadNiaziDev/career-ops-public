// Blueprint S07 · gap 4 — "Spills 4 lines onto page 2", with a one-click Fit to
// one page that tightens density and padding, previewed before committing.
//
// The tightening ladder is deliberate and small: density first (it reclaims the
// most vertical space per unit of ugliness), then page padding. Anything beyond
// that is an editorial decision the user should make in the markdown.

import type { CvPageFormat } from "@/lib/cv/page";
import { overflowLines, pageCount } from "@/lib/cv/page";

export type CvStyleLike = { density: string; margin: string };

export type FitVerdict = {
  pages: number;
  spillLines: number;
  /** A tighter style that might fit, or null when nothing is left to tighten. */
  proposal: CvStyleLike | null;
  /** Human sentence for the toolbar and the fit panel. */
  message: string;
};

const DENSITY_LADDER = ["spacious", "standard", "compact"];
const MARGIN_LADDER = ["10px 0", "2px 0", "0"];

function tightenOnce(style: CvStyleLike): CvStyleLike | null {
  const d = DENSITY_LADDER.indexOf(style.density);
  if (d >= 0 && d < DENSITY_LADDER.length - 1) {
    return { ...style, density: DENSITY_LADDER[d + 1] };
  }
  const m = MARGIN_LADDER.indexOf(style.margin);
  if (m >= 0 && m < MARGIN_LADDER.length - 1) {
    return { ...style, margin: MARGIN_LADDER[m + 1] };
  }
  return null;
}

/** The tightest style the ladder can reach from here (what "Fit to one page" applies). */
export function tightestStyle(style: CvStyleLike): CvStyleLike | null {
  let current = style;
  let moved = false;
  for (;;) {
    const next = tightenOnce(current);
    if (!next) break;
    current = next;
    moved = true;
  }
  return moved ? current : null;
}

export function describeChange(from: CvStyleLike, to: CvStyleLike): string[] {
  const out: string[] = [];
  if (from.density !== to.density) out.push(`density ${from.density} → ${to.density}`);
  if (from.margin !== to.margin) out.push(`page padding ${from.margin || "0"} → ${to.margin || "0"}`);
  return out;
}

export function assessFit(docHeight: number, format: CvPageFormat, style: CvStyleLike): FitVerdict {
  const pages = pageCount(docHeight, format);
  const spillLines = overflowLines(docHeight, format);
  if (pages <= 1) {
    return { pages, spillLines: 0, proposal: null, message: "Fits one page" };
  }
  const proposal = tightestStyle(style);
  const spill = `Spills ${spillLines} line${spillLines === 1 ? "" : "s"} onto page ${pages}`;
  return {
    pages,
    spillLines,
    proposal,
    message: proposal ? spill : `${spill} — already at the tightest style`,
  };
}
