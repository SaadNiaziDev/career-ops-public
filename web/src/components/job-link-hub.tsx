"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Input } from "@/components/ui/md3-input";
import { Md3Card } from "@/components/ui/md3-card";
import { useJobs } from "@/components/jobs/job-store";
import { aiToParams } from "@/lib/explore";
import { cn } from "@/lib/cn";

function guessFromUrl(url: string): { company: string; title: string } {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const slug = u.pathname.split("/").filter(Boolean).pop()?.replace(/[-_]/g, " ") ?? "";
    return { company: host, title: slug && slug.length > 3 ? slug.slice(0, 80) : "Job posting" };
  } catch { return { company: "", title: "Job posting" }; }
}

function normalizeUrl(raw: string): string | null {
  try {
    const value = new URL(raw.trim());
    return ["http:", "https:"].includes(value.protocol) && value.hostname.includes(".") ? value.href : null;
  } catch { return null; }
}

type Inspection = {
  url: string;
  liveness: { result: "active" | "expired" | "uncertain"; reason: string; via: string } | null;
  existing: { kind: string; href: string; label: string } | null;
  hasCv: boolean;
  recommendation: "open-existing" | "open-posting" | "evaluate";
};

type Props = { compact?: boolean; origin?: string; className?: string };

export function JobLinkHub({ compact = false, origin = "/add", className }: Props) {
  const router = useRouter();
  const { startJob } = useJobs();
  const [raw, setRaw] = useState("");
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const url = normalizeUrl(raw);
  const flash = (tone: "info" | "error" | "success", text: string) => setNotice({ tone, text });

  const inspect = useCallback(async () => {
    if (!url) { flash("error", "Enter a full public job URL beginning with https://."); return; }
    setBusy(true); setNotice(null); setInspection(null);
    try {
      const response = await fetch("/api/job-intake/inspect", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not check this link.");
      setInspection(data as Inspection);
    } catch (error) {
      flash("error", error instanceof Error ? error.message : "Could not check this link.");
    } finally { setBusy(false); }
  }, [url]);

  const evaluate = (allowUnverified = false) => {
    if (!inspection || !inspection.hasCv) return;
    if (inspection.liveness?.result === "expired") return;
    if (inspection.liveness?.result !== "active" && !allowUnverified) { flash("info", "The posting could not be verified. Confirm it is open before spending tokens."); return; }
    startJob({ title: "Evaluate · pasted URL", subtitle: guessFromUrl(inspection.url).title, kind: "evaluate", input: inspection.url, page: origin });
    flash("info", "Evaluation started. Follow progress in Activity.");
  };

  const addInbox = async () => {
    if (!inspection) return;
    setBusy(true);
    const { company, title } = guessFromUrl(inspection.url);
    try {
      const response = await fetch("/api/explore/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offers: [{ url: inspection.url, company, title, location: "", postedAt: "", ats: "other", source: "manual" }] }),
      });
      const data = await response.json();
      if (!response.ok || data.error || !data.added) throw new Error(data.error || "This link is already in the inbox.");
      flash("success", "Added to your pipeline inbox."); router.refresh();
    } catch (error) { flash("error", error instanceof Error ? error.message : "Could not add this link."); }
    finally { setBusy(false); }
  };

  const openPosting = () => inspection && window.open(inspection.url, "_blank", "noopener,noreferrer");
  const searchSimilar = () => {
    if (!inspection) return;
    router.push(`/explore?${aiToParams(`Find open job postings similar to this role (same seniority and stack where possible): ${inspection.url}`)}`);
  };

  const recommendation = inspection?.recommendation === "open-existing"
    ? inspection.existing?.label ?? "Open existing role"
    : inspection?.recommendation === "open-posting" ? "Open posting to confirm" : "Evaluate this role";
  const act = () => {
    if (!inspection) return;
    if (inspection.existing) router.push(inspection.existing.href);
    else if (inspection.recommendation === "open-posting") openPosting();
    else evaluate(inspection.liveness?.result === "active");
  };

  const body = (
    <>
      {notice && <p role="status" className={cn("md3-alert mb-3", `md3-alert--${notice.tone}`)}>{notice.text}</p>}
      <div data-co-tour="add-job-hub"><Md3Input
        icon="link" type="url" placeholder="https://company.com/careers/…" value={raw}
        onChange={(event) => { setRaw(event.target.value); setInspection(null); }}
        onKeyDown={(event) => event.key === "Enter" && void inspect()}
        aria-label="Job posting URL"
      /></div>
      <div className={cn("md3-actions-row mt-4", compact && "mt-3")} data-co-tour="add-job-actions">
        <Md3ActionButton variant="filled" icon="travel_explore" disabled={!url} loading={busy} onClick={() => void inspect()}>
          Check link
        </Md3ActionButton>
      </div>
      {inspection && (
        <section className="mt-4 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-4" aria-live="polite">
          <p className="mb-1 md-title-small">{guessFromUrl(inspection.url).title}</p>
          <p className="mb-3 md-body-small text-[var(--md-sys-color-on-surface-variant)]">
            {inspection.existing ? "Already in your pipeline." : `Posting check: ${inspection.liveness?.result}. ${inspection.liveness?.reason}`}
          </p>
          {!inspection.existing && inspection.recommendation === "evaluate" && !inspection.hasCv && (
            <p className="md3-alert md3-alert--warning mb-3">Add a CV before evaluating. <Link className="underline" href="/cv">Set up your CV</Link>.</p>
          )}
          {inspection.existing ? <Link className="md3-button md3-button--filled" href={inspection.existing.href}>{recommendation}</Link> :
            <Md3ActionButton variant="filled" icon={inspection.recommendation === "evaluate" ? "bolt" : "open_in_new"}
              cost={inspection.recommendation === "evaluate" ? "spend" : undefined}
              disabled={inspection.recommendation === "evaluate" && !inspection.hasCv} onClick={act}>
              {recommendation}
            </Md3ActionButton>}
          {inspection.liveness?.result === "uncertain" && !inspection.existing && inspection.hasCv && (
            <button className="ml-3 text-sm underline" onClick={() => evaluate(true)}>Evaluate after my check</button>
          )}
          <button className="ml-3 text-sm underline" onClick={() => setShowAlternatives((value) => !value)}>
            {showAlternatives ? "Hide other options" : "Other options"}
          </button>
          {showAlternatives && !inspection.existing && <div className="mt-3 flex flex-wrap gap-3">
            <button className="text-sm underline" disabled={busy} onClick={() => void addInbox()}>Add to inbox</button>
            <button className="text-sm underline" onClick={openPosting}>Open posting</button>
            <button className="text-sm underline" onClick={searchSimilar}>Search for similar jobs</button>
          </div>}
        </section>
      )}
      {!compact && <p className="mb-0 mt-4 md-body-small leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
        Check the posting and your pipeline first. Evaluation uses AI; adding to your inbox is free.
      </p>}
    </>
  );

  if (compact) return <div className={cn("rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-5 sm:p-6", className)}>
    <p className="md-eyebrow">Quick add</p><p className="mt-1 md-title-medium text-[var(--md-sys-color-on-surface)]">Paste a job URL</p>{body}
  </div>;
  return <Md3Card className={className} title={<span className="md-title-medium">Paste a job link</span>}>
    {body}<div className="mt-3"><Link href="/pipeline?tab=INBOX" className="md-body-small text-[var(--md-sys-color-primary)] hover:underline">View pipeline inbox →</Link></div>
  </Md3Card>;
}
