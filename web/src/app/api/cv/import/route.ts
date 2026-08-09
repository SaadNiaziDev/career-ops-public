import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { atomicWriteWithBackup } from "@/lib/core/safe-write";
import { CV_SOURCE_EXT_RE, cvSourcesDir, resolveCvSource } from "@/lib/cv/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CV_BYTES = 200_000;

function safeFilename(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  const ext = path.extname(base);
  const stem = path.basename(base, ext) || "imported-cv";
  return `${stem}${CV_SOURCE_EXT_RE.test(ext) ? ext : ".md"}`;
}

/** Decoded text is only usable if it really is text — a PDF/DOCX would land as mojibake. */
function looksBinary(buf: Buffer): boolean {
  const head = buf.subarray(0, 512);
  if (head.includes(0)) return true;
  if (head.subarray(0, 5).toString("latin1") === "%PDF-") return true;
  if (head.subarray(0, 2).toString("latin1") === "PK") return true; // docx/odt zip container
  return false;
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid upload" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  if (!CV_SOURCE_EXT_RE.test(path.extname(file.name))) {
    return NextResponse.json({ error: "only .md, .markdown or .txt files can be imported" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > MAX_CV_BYTES) return NextResponse.json({ error: "file too large (max 200KB)" }, { status: 413 });
  if (looksBinary(buf)) {
    return NextResponse.json({ error: "that file isn't plain text — paste the CV text instead" }, { status: 400 });
  }

  const text = buf.toString("utf8");
  if (!text.trim()) return NextResponse.json({ error: "empty file" }, { status: 400 });

  const dir = cvSourcesDir();
  const first = safeFilename(file.name);
  const ext = path.extname(first);
  const stem = path.basename(first, ext);

  let name = first;
  let n = 1;
  while (fs.existsSync(path.join(dir, name))) {
    name = `${stem}-${n}${ext}`;
    n++;
  }

  const rel = `data/cv-sources/${name}`;
  const abs = resolveCvSource(rel);
  if (!abs) return NextResponse.json({ error: "import path rejected" }, { status: 400 });

  try {
    atomicWriteWithBackup(abs, text);
  } catch {
    return NextResponse.json({ error: "write failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path: rel, content: text });
}
