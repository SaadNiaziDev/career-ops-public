import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { readProfile } from "@/lib/cv/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The CVs the `pdf` mode already wrote to output/ — one tailored render per
// company. The studio can show any of them so you can look at a real, finished
// CV instead of previewing the whole of cv.md, which is a superset the renderer
// trims per job.
//
// Read-only by construction: only .html files directly inside output/ are
// served, and nothing here writes.

function outputDir(): string {
  return path.join(careerOpsRoot(), "output");
}

/** Resolve a requested filename to a real file inside output/, or null. */
function resolveGenerated(name: string): string | null {
  const cleaned = (name ?? "").replace(/\\/g, "/").trim();
  // A bare filename only — no directories, no traversal, html only.
  if (!cleaned || cleaned.includes("/") || cleaned.includes("\0")) return null;
  if (!/^[A-Za-z0-9._-]+\.html$/.test(cleaned)) return null;

  const abs = path.resolve(outputDir(), cleaned);
  const back = path.relative(outputDir(), abs);
  if (!back || back.startsWith("..") || path.isAbsolute(back)) return null;
  try {
    if (!fs.statSync(abs).isFile()) return null;
  } catch {
    return null;
  }
  return abs;
}

/**
 * "cv-saad-ali-khan-spotter-ai.html" → "Spotter Ai". The pdf mode names files
 * `cv-{candidate}-{company}[-date]`, so the candidate's own slug is what has to
 * come off — counting words from the end guesses wrong on one-word companies.
 */
function labelFor(file: string, nameSlug: string): string {
  let stem = file.replace(/\.html$/i, "").replace(/^cv-/i, "");
  stem = stem.replace(/-\d{4}-\d{2}-\d{2}$/, "");
  if (nameSlug && stem.toLowerCase().startsWith(`${nameSlug}-`)) {
    stem = stem.slice(nameSlug.length + 1);
  }
  const words = stem.split("-").filter(Boolean);
  if (words.length === 0) return file;
  return words.join(" ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** The candidate slug the pdf mode builds filenames from. */
function candidateSlug(): string {
  const name = readProfile().candidate;
  const full =
    name && typeof name === "object" && !Array.isArray(name)
      ? (name as Record<string, unknown>).full_name
      : undefined;
  if (typeof full !== "string") return "";
  return (full.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-");
}

export async function GET(req: Request) {
  const file = new URL(req.url).searchParams.get("file");

  if (file) {
    const abs = resolveGenerated(file);
    if (!abs) return NextResponse.json({ error: "unknown generated CV" }, { status: 404 });
    try {
      return new Response(fs.readFileSync(abs, "utf8"), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      });
    } catch {
      return NextResponse.json({ error: "could not read that file" }, { status: 500 });
    }
  }

  let all: string[];
  try {
    all = fs.readdirSync(outputDir());
  } catch {
    return NextResponse.json({ generated: [] });
  }

  const pdfs = all.filter((f) => f.toLowerCase().endsWith(".pdf"));
  const slug = candidateSlug();

  const generated = all
    .filter((f) => f.toLowerCase().endsWith(".html"))
    .map((f) => {
      let mtime = 0;
      try {
        mtime = fs.statSync(path.join(outputDir(), f)).mtimeMs;
      } catch {
        /* raced with a delete */
      }
      // The printed PDF carries a date suffix the HTML does not, so match on
      // the stem rather than on an exact name swap.
      const stem = f.replace(/\.html$/i, "").toLowerCase();
      const pdf = pdfs.some((p) => p.toLowerCase().startsWith(stem));
      return { file: f, label: labelFor(f, slug), mtime, pdf };
    })
    .sort((a, b) => b.mtime - a.mtime);

  return NextResponse.json({ generated });
}
