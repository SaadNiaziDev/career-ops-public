import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { careerOpsRoot, readApplications } from "@/lib/career-ops";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") ?? "tracker";
  const root = careerOpsRoot();

  if (kind === "tracker") {
    const rows = readApplications();
    const header = ["num", "date", "company", "role", "status", "score", "pdf", "report", "notes"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.n, r.date, r.company, r.role, r.status, r.score, r.pdf, r.report, r.notes]
          .map((v) => csvEscape(String(v ?? "")))
          .join(","),
      ),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="career-ops-tracker-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (kind === "analytics") {
    const apps = readApplications();
    const byStatus = new Map<string, number>();
    for (const a of apps) {
      const s = a.status || "Unknown";
      byStatus.set(s, (byStatus.get(s) ?? 0) + 1);
    }
    const lines = ["status,count", ...Array.from(byStatus.entries()).map(([s, c]) => `${csvEscape(s)},${c}`)];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="career-ops-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  if (kind === "all") {
    const payload = {
      exportedAt: new Date().toISOString(),
      applications: readApplications(),
      cv: fs.existsSync(path.join(root, "cv.md")) ? fs.readFileSync(path.join(root, "cv.md"), "utf8") : null,
      pipeline: fs.existsSync(path.join(root, "data/pipeline.md"))
        ? fs.readFileSync(path.join(root, "data/pipeline.md"), "utf8")
        : null,
    };
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="career-ops-export-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  }

  return NextResponse.json({ error: "Unknown export kind" }, { status: 400 });
}
