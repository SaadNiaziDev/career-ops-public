"use client";

import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { cn } from "@/lib/cn";
import { canonStatus } from "@/lib/format";

// Entry point from a pipeline row/report into its Apply kit (/apply?n=<num>).
// The kit prepares whatever is missing (CV, answers, cover letter) itself, so
// this is never locked behind "generate the PDF first".
export function ApplyButton({
  n,
  url,
  status,
  rail = false,
}: {
  n: string;
  url?: string;
  company: string;
  pdfReady: boolean;
  status?: string;
  rail?: boolean;
}) {
  const canonicalStatus = canonStatus(status ?? "");
  const applied = ["APPLIED", "RESPONDED"].includes(canonicalStatus);
  const hasUrl = !!url && /^https?:\/\//i.test(url);

  return (
    <Link
      href={`/apply?n=${encodeURIComponent(n)}`}
      className={cn("md3-action-btn", applied ? "md3-action-btn--outlined" : "md3-action-btn--filled", rail && "w-full")}
      title={hasUrl ? "Open the Apply kit: CV, answers, cover letter, then you submit" : "Open the Apply kit (this report has no application URL yet)"}
    >
      <MaterialSymbol name={applied ? "inventory_2" : "send"} size={18} />
      <span className="md3-action-btn__label">{applied ? "Apply kit" : "Apply"}</span>
    </Link>
  );
}
