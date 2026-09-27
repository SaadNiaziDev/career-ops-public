import { NextRequest } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot } from "@/lib/career-ops";
import { artifactPath } from "@/lib/cv/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serve the tailored CV PDF the pdf mode wrote to output/cv-…-{company}-…pdf for
// a given offer (matched by company slug, newest first). Inline so it opens in
// the browser. Local-first: reads the user's own output/ dir.
export async function GET(req: NextRequest) {
  const report = (req.nextUrl.searchParams.get("report") ?? "").trim();
  const company = (req.nextUrl.searchParams.get("company") ?? "").trim();
  if (!report && !company) return new Response("report or company required", { status: 400 });
  if (report && !/^\d+$/.test(report)) return new Response("invalid report", { status: 400 });
  if (report) {
    let lines: string[];
    try { lines = fs.readFileSync(path.join(careerOpsRoot(), "data/pdf-index.tsv"), "utf8").split("\n"); }
    catch { return new Response("no tailored CV found for this report", { status: 404 }); }
    const entry = lines.map(line => line.split("\t")).filter(cols => Number(cols[0]) === Number(report) && cols[1]?.startsWith("output/")).at(-1);
    const name = entry?.[1]?.slice("output/".length) ?? "";
    const file = name && artifactPath(name, "pdf");
    if (!file) return new Response("no tailored CV found for this report", { status: 404 });
    try {
      return new Response(new Uint8Array(fs.readFileSync(file)), {
        status: 200,
        headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${path.basename(file)}"`, "Cache-Control": "no-store" },
      });
    } catch {
      return new Response("could not read the PDF", { status: 500 });
    }
  }
  // Token-extract instead of replace-then-trim: same slug, and no `-+$`-style
  // pattern that backtracks polynomially on adversarial input (CodeQL).
  const slug = (company.toLowerCase().match(/[a-z0-9]+/g) ?? []).join("-");
  const dir = path.join(careerOpsRoot(), "output");
  // Match the slug at a token boundary (delimited by non-alphanumerics) so "Meta"
  // doesn't serve "Metabase"'s tailored CV. The pdf mode names files cv-…-{slug}-….
  const re = new RegExp(`(^|[^a-z0-9])${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i");

  let files: string[];
  try {
    files = fs
      .readdirSync(dir)
      .filter((f) => f.toLowerCase().endsWith(".pdf"))
      .filter((f) => re.test(f.toLowerCase()));
  } catch {
    return new Response("no output directory", { status: 404 });
  }
  if (!files.length) return new Response("no tailored CV found for this offer", { status: 404 });

  files.sort((a, b) => fs.statSync(path.join(dir, b)).mtimeMs - fs.statSync(path.join(dir, a)).mtimeMs);
  const file = path.join(dir, files[0]);
  try {
    const buf = fs.readFileSync(file);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${files[0]}"`, "Cache-Control": "no-store" },
    });
  } catch {
    return new Response("could not read the PDF", { status: 500 });
  }
}
