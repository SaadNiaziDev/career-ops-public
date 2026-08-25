/**
 * Best-effort text extraction from a CV PDF. No extra dependency — resumes from
 * Word / Google Docs / typical exporters store strings in Tj/TJ operators,
 * often inside FlateDecode streams. Scanned-image PDFs return null.
 *
 * @param {Buffer | Uint8Array} buf
 * @returns {string | null}
 */
import { inflateSync } from "node:zlib";

export function extractPdfText(buf) {
  if (!buf || buf.length < 8) return null;
  const bytes = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") return null;

  const latin = bytes.toString("latin1");
  const chunks = [];
  collectPdfStrings(latin, chunks);

  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m;
  while ((m = streamRe.exec(latin))) {
    const dict = latin.slice(Math.max(0, m.index - 500), m.index);
    if (!/\/FlateDecode/.test(dict)) continue;
    let payload = Buffer.from(m[1], "latin1");
    // The bytes between `stream\n` and `endstream` may include a trailing newline
    // that is not part of the deflate payload.
    if (payload.length && payload[payload.length - 1] === 0x0a) payload = payload.subarray(0, -1);
    if (payload.length && payload[payload.length - 1] === 0x0d) payload = payload.subarray(0, -1);
    try {
      collectPdfStrings(inflateSync(payload).toString("latin1"), chunks);
    } catch {
      /* not a valid deflate stream — skip */
    }
  }

  const text = chunks
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\n]{2,}/g, " ")
    .trim();
  return text.length >= 40 ? text : text.length > 0 ? text : null;
}

/**
 * @param {string} src
 * @param {string[]} chunks
 */
function collectPdfStrings(src, chunks) {
  const tj = /\[([\s\S]*?)\]\s*TJ/g;
  let m;
  while ((m = tj.exec(src))) {
    const inner = m[1];
    const parts = [];
    const token = /\((?:\\.|[^\\)])*\)|<[\s0-9A-Fa-f]+>/g;
    let t;
    while ((t = token.exec(inner))) {
      const decoded = t[0][0] === "<" ? decodeHexString(t[0].slice(1, -1)) : decodePdfLiteral(t[0]);
      if (decoded) parts.push(decoded);
    }
    if (parts.length) {
      chunks.push(parts.join(""));
      chunks.push("\n");
    }
  }

  const tjSingle = /\((?:\\.|[^\\)])*\)\s*(?:Tj|'|")/g;
  while ((m = tjSingle.exec(src))) {
    const decoded = decodePdfLiteral(m[0].replace(/\s*(?:Tj|'|")\s*$/, ""));
    if (decoded) {
      chunks.push(decoded);
      chunks.push(m[0].includes("'") || m[0].includes('"') ? "\n" : " ");
    }
  }
}

/**
 * @param {string} raw parentheses-wrapped PDF literal
 * @returns {string}
 */
function decodePdfLiteral(raw) {
  if (!raw.startsWith("(") || !raw.endsWith(")")) return "";
  let s = raw.slice(1, -1);
  s = s.replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8) & 255));
  s = s.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\b/g, "\b").replace(/\\f/g, "\f");
  s = s.replace(/\\([()\\])/g, "$1");
  const printable = s.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  return printable;
}

/**
 * @param {string} hex
 * @returns {string}
 */
function decodeHexString(hex) {
  const h = hex.replace(/\s+/g, "");
  if (!h.length || h.length % 2) return "";
  const bytes = Buffer.from(h, "hex");
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return bytes.subarray(2).swap16().toString("utf16le");
  }
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return bytes.subarray(2).toString("utf16le");
  }
  // UTF-16BE without BOM is common in Word-exported CVs (lots of 00 high bytes).
  if (bytes.length >= 4 && bytes[0] === 0x00 && bytes[2] === 0x00) {
    return Buffer.from(bytes).swap16().toString("utf16le");
  }
  return bytes.toString("latin1").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
}
