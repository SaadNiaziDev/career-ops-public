import fs from "node:fs";
import { NextResponse } from "next/server";
import { artifactPath, cvArtifacts } from "@/lib/cv/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const file = new URL(req.url).searchParams.get("file");
  if (!file) return NextResponse.json({ generated: cvArtifacts() });
  const extension = file.endsWith(".pdf") ? "pdf" : "html";
  const abs = artifactPath(file, extension);
  if (!abs) return NextResponse.json({ error: "Generated CV not found" }, { status: 404 });
  return new Response(new Uint8Array(fs.readFileSync(abs)), {
    headers: { "Content-Type": extension === "pdf" ? "application/pdf" : "text/html; charset=utf-8",
      "Content-Disposition": `${extension === "pdf" ? "attachment" : "inline"}; filename="${file}"`,
      "Cache-Control": "no-store", "Content-Security-Policy": "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:" },
  });
}
