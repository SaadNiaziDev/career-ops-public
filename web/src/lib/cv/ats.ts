// Blueprint S08 · redline 5 — the ATS check. Four things a parser needs:
// selectable text, no images standing in for text, headings it recognises, and
// contact details. ADVISORY, NEVER BLOCKING: it colours a chip and lists what is
// missing, and nothing in the app refuses to run because of it.

export type AtsCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
};

const HEADING_PATTERNS: [string, RegExp][] = [
  ["Experience", /^#{1,3}\s*(work\s+)?(experience|employment|work history)/im],
  ["Skills", /^#{1,3}\s*(skills|competenc|technolog)/im],
  ["Education", /^#{1,3}\s*education/im],
];

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;

/**
 * Runs against the markdown source and the rendered HTML together: the source
 * says what the writer wrote, the render says what a parser would actually see.
 */
export function runAtsChecks(markdown: string, html: string): AtsCheck[] {
  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const imgCount = (html.match(/<img\b/gi) || []).length;
  const bgImages = (html.match(/background-image\s*:/gi) || []).length;

  const foundHeadings = HEADING_PATTERNS.filter(([, re]) => re.test(markdown)).map(([name]) => name);
  const missingHeadings = HEADING_PATTERNS.filter(([, re]) => !re.test(markdown)).map(([name]) => name);

  const hasEmail = EMAIL_RE.test(markdown);
  const hasPhone = PHONE_RE.test(markdown);

  return [
    {
      id: "text",
      label: "Selectable text",
      ok: textOnly.length > 400,
      detail:
        textOnly.length > 400
          ? `${textOnly.length.toLocaleString()} characters a parser can read`
          : "Very little machine-readable text — the render may be mostly layout",
    },
    {
      id: "images",
      label: "No images in place of text",
      // A single portrait is normal and parses fine; a wall of images is not.
      ok: imgCount <= 1 && bgImages === 0,
      detail:
        imgCount <= 1 && bgImages === 0
          ? imgCount === 1
            ? "One image (portrait) — text is still text"
            : "No images"
          : `${imgCount} images${bgImages ? ` + ${bgImages} CSS backgrounds` : ""} — parsers ignore all of them`,
    },
    {
      id: "headings",
      label: "Recognised headings",
      ok: missingHeadings.length === 0,
      detail: missingHeadings.length === 0 ? foundHeadings.join(" · ") : `Missing: ${missingHeadings.join(", ")}`,
    },
    {
      id: "contact",
      label: "Contact details present",
      ok: hasEmail,
      detail: hasEmail ? (hasPhone ? "Email and phone" : "Email — no phone number found") : "No email address found",
    },
  ];
}
