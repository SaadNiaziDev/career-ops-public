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
    const title = slug && slug.length > 3 ? slug.slice(0, 80) : "Job posting";
    return { company: host, title };
  } catch {
    return { company: "", title: "Job posting" };
  }
}

function normalizeUrl(raw: string): string | null {
  const u = raw.trim();
  if (!/^https?:\/\//i.test(u)) return null;
  try {
    return new URL(u).href;
  } catch {
    return null;
  }
}

type Props = {
  compact?: boolean;
  origin?: string;
  className?: string;
};

export function JobLinkHub({ compact = false, origin = "/add", className }: Props) {
  const router = useRouter();
  const { startJob } = useJobs();
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "error" | "success"; text: string } | null>(null);

  const url = normalizeUrl(raw);

  const flash = (tone: "info" | "error" | "success", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const evaluate = useCallback(() => {
    if (!url) {
      flash("error", "Paste a full job URL (https://…).");
      return;
    }
    startJob({
      title: "Evaluate · pasted URL",
      subtitle: guessFromUrl(url).title,
      kind: "evaluate",
      input: url,
      page: origin,
    });
    flash("info", "Evaluation started — track progress in Workers.");
    setRaw("");
  }, [url, startJob, origin]);

  const addInbox = useCallback(async () => {
    if (!url) {
      flash("error", "Paste a full job URL (https://…).");
      return;
    }
    setBusy(true);
    const { company, title } = guessFromUrl(url);
    try {
      const res = await fetch("/api/explore/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offers: [{ url, company, title, location: "", postedAt: "", ats: "other", source: "manual" }],
        }),
      });
      const data = (await res.json()) as { added?: number; error?: string };
      if (data.error || !data.added) {
        throw new Error(data.error || "Could not add to inbox");
      }
      flash("success", "Added to pipeline inbox");
      setRaw("");
      router.refresh();
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }, [url, router]);

  const aiSearchSimilar = useCallback(() => {
    if (!url) {
      flash("error", "Paste a full job URL (https://…).");
      return;
    }
    const intent = `Find open job postings similar to this role (same seniority and stack where possible): ${url}`;
    router.push(`/explore?${aiToParams(intent)}`);
  }, [url, router]);

  const openExternal = useCallback(() => {
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [url]);

  const body = (
    <>
      {notice ? (
        <p className={cn("md3-alert mb-3", `md3-alert--${notice.tone === "info" ? "info" : notice.tone}`)}>{notice.text}</p>
      ) : null}
      <Md3Input
        icon="link"
        type="url"
        placeholder="https://company.com/careers/…"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && evaluate()}
      />
      <div className={cn("md3-actions-row mt-4", compact && "mt-3")}>
        <Md3ActionButton variant="filled" icon="bolt" cost="spend" disabled={!url} onClick={evaluate}>
          Evaluate
        </Md3ActionButton>
        <Md3ActionButton variant="outlined" icon="inbox" cost="free-network" disabled={!url} loading={busy} onClick={() => void addInbox()}>
          Add to inbox
        </Md3ActionButton>
        <Md3ActionButton variant="outlined" icon="explore" disabled={!url} onClick={aiSearchSimilar}>
          AI search similar
        </Md3ActionButton>
        <Md3ActionButton variant="text" icon="open_in_new" disabled={!url} onClick={openExternal}>
          Open posting
        </Md3ActionButton>
      </div>
      {!compact && (
        <p className="mb-0 mt-4 md-body-small leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
          <strong className="text-[var(--md-sys-color-on-surface)]">Evaluate</strong> runs the full A–F report and tracker row.{" "}
          <strong className="text-[var(--md-sys-color-on-surface)]">Add to inbox</strong> queues the URL for triage without spending tokens.{" "}
          <strong className="text-[var(--md-sys-color-on-surface)]">AI search similar</strong> opens Explore with a hunt for like roles.
        </p>
      )}
    </>
  );

  if (compact) {
    return (
      <div
        className={cn(
          "rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-5 sm:p-6",
          className,
        )}
      >
        <p className="md-eyebrow">Quick add</p>
        <p className="mt-1 md-title-medium text-[var(--md-sys-color-on-surface)]">Paste a job URL</p>
        {body}
      </div>
    );
  }

  return (
    <Md3Card className={className} title={<span className="md-title-medium">Paste a job link</span>}>
      {body}
      <div className="mt-3">
        <Link href="/pipeline?tab=INBOX" className="md-body-small text-[var(--md-sys-color-primary)] hover:underline">
          View pipeline inbox →
        </Link>
      </div>
    </Md3Card>
  );
}
