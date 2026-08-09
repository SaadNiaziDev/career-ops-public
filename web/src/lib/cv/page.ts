// Printed page geometry — pure, so the studio (client) and the settings writer
// (server) measure against the same box. Blueprint S07 · redline 3: A4 is the
// default and the box must be switchable; the shipped code was Letter-only.

export type CvPageFormat = "a4" | "letter";

export const DEFAULT_PAGE_FORMAT: CvPageFormat = "a4";

/** Page box in CSS px at 96dpi — A4 794×1123, US Letter 816×1056. */
export const PAGE_BOX: Record<CvPageFormat, { width: number; height: number; label: string }> = {
  a4: { width: 794, height: 1123, label: "A4" },
  letter: { width: 816, height: 1056, label: "Letter" },
};

export function pageBox(format: CvPageFormat) {
  return PAGE_BOX[format] ?? PAGE_BOX[DEFAULT_PAGE_FORMAT];
}

/** How many pages a rendered document of this height occupies. */
export function pageCount(docHeight: number, format: CvPageFormat): number {
  return Math.max(1, Math.ceil(docHeight / pageBox(format).height));
}

/**
 * Overflow past the last full page, expressed in lines at the template's base
 * line height. "Spills 4 lines onto page 2" is more actionable than "1.04 pages".
 */
export const CV_LINE_HEIGHT_PX = 17.6; // 11px base × 1.6 line-height

export function overflowLines(docHeight: number, format: CvPageFormat): number {
  const { height } = pageBox(format);
  const pages = pageCount(docHeight, format);
  if (pages <= 1) return 0;
  const spill = docHeight - (pages - 1) * height;
  return Math.max(1, Math.round(spill / CV_LINE_HEIGHT_PX));
}
