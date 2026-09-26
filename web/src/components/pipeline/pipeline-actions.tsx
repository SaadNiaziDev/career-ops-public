"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useJobs } from "@/components/jobs/job-store";
import { GeneratePdfButton } from "@/components/generate-pdf-button";
import { ApplyButton } from "@/components/apply-button";
import { CostBadge } from "@/components/cost/cost-badge";
import type { DraftKind } from "@/lib/contacts";
import { cn } from "@/lib/cn";
import { canonStatus } from "@/lib/format";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type DraftState = { kind: DraftKind; content: string } | null;

const KIND_LABEL: Record<DraftKind, string> = {
  cover: "Cover letter",
  email: "Application email",
  contacto: "Outreach contacts",
};

const RUN_LABEL: Record<DraftKind, string> = {
  cover: "Write cover letter",
  email: "Draft application email",
  contacto: "Find people to reach out to",
};

const KIND_ICON: Record<DraftKind, string> = {
  cover: "description",
  email: "mail",
  contacto: "group",
};

export function PipelineActions({
  n,
  company,
  role,
  url,
  pdfReady,
  status,
  variant = "inline",
}: {
  n: string;
  company: string;
  role?: string;
  url?: string;
  pdfReady: boolean;
  status?: string;
  variant?: "inline" | "rail";
}) {
  const { jobs, startJob } = useJobs();
  const [draft, setDraft] = useState<DraftState>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const panelRef = useRef<HTMLElement>(null);
  useDialogFocus(panelOpen, panelRef);
  const [available, setAvailable] = useState<DraftKind[]>([]);
  const [notice, setNotice] = useState<{ tone: "info" | "warning" | "success"; text: string } | null>(null);
  const rail = variant === "rail";
  const showInterview = (() => {
    const c = canonStatus(status ?? "");
    return c.includes("INTERVIEW") || c.includes("OFFER");
  })();

  const flash = (tone: "info" | "warning" | "success", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const loadDrafts = useCallback(() => {
    fetch(`/api/drafts?n=${encodeURIComponent(n)}`)
      .then((r) => r.json())
      .then((d) => {
        const rawKinds = (Array.isArray(d.drafts) ? d.drafts : []) as { kind?: string }[];
        const kinds = rawKinds
          .map((x) => x.kind)
          .filter((k: string | undefined): k is DraftKind => k === "cover" || k === "email" || k === "contacto");
        setAvailable([...new Set<DraftKind>(kinds)]);
      })
      .catch(() => {});
  }, [n]);

  useEffect(() => {
    loadDrafts();
    const onDone = () => loadDrafts();
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [loadDrafts]);

  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [panelOpen]);

  const runningKind = useMemo(() => {
    const active = jobs.find((j) => j.input === n && j.status === "running" && ["cover", "email", "contacto"].includes(j.kind ?? ""));
    return active?.kind as DraftKind | undefined;
  }, [jobs, n]);

  const run = (kind: DraftKind) => {
    const id = startJob({
      title: `${KIND_LABEL[kind]} · ${company}`,
      subtitle: role ?? company,
      kind,
      input: n,
      page: `/pipeline/${n}`,
    });
    if (id) flash("info", `Started ${KIND_LABEL[kind].toLowerCase()} — check Workers for progress.`);
  };

  const openDraft = async (kind: DraftKind) => {
    const res = await fetch(`/api/drafts?n=${encodeURIComponent(n)}&kind=${kind}`);
    if (!res.ok) {
      flash("warning", "Draft not ready yet — run the worker first.");
      return;
    }
    const data = await res.json();
    setDraft({ kind, content: data.content ?? "" });
    setPanelOpen(true);
  };

  const actionBtn = (kind: DraftKind) => {
    const has = available.includes(kind);
    const running = runningKind === kind;
    const label = has ? `View ${KIND_LABEL[kind].toLowerCase()}` : RUN_LABEL[kind];
    return (
      <Button
        key={kind}
        variant={rail && kind === "cover" && !has ? "outline" : rail ? "outline" : "outline"}
        className={cn(rail && "w-full")}
        onClick={() => (has ? void openDraft(kind) : run(kind))}
        onContextMenu={(e) => {
          e.preventDefault();
          run(kind);
        }}
      >
        {running ? (
          <MaterialSymbol name="progress_activity" size={18} className="animate-spin" />
        ) : (
          <MaterialSymbol name={KIND_ICON[kind]} size={18} />
        )}
        {label}
      </Button>
    );
  };

  const applyControl = <ApplyButton n={n} url={url?.startsWith("http") ? url : undefined} company={company} pdfReady={pdfReady} status={status} rail={rail} />;
  const actions = rail ? (
    <>
      {showInterview ? (
        <Link href={`/pipeline/${n}/interview`} className="md3-btn-outlined flex w-full items-center justify-center gap-2">
          <MaterialSymbol name="psychology" size={18} />Interview workspace
        </Link>
      ) : ["APPLIED", "RESPONDED"].includes(canonStatus(status ?? "")) ? applyControl : (
        <section aria-label="Application preparation checklist" className="space-y-3 rounded-xl border border-[var(--md-sys-color-outline-variant)] p-3">
          <h2 className="md-title-small">Prepare your application</h2>
          <ol className="space-y-3 text-sm">
            <li><p className="mb-1 font-medium">1. Tailored CV {pdfReady ? "· ready" : "· needed"}</p><GeneratePdfButton n={n} company={company} pdfReady={pdfReady} rail /></li>
            <li><p className="mb-1 font-medium">2. Optional cover letter draft</p>{actionBtn("cover")}</li>
            <li><p className="mb-1 font-medium">3. Review the application form</p>{applyControl}</li>
            <li className="text-xs text-[var(--md-sys-color-on-surface-variant)]">4. Submit on the company site. Then confirm Applied in the Decision panel; career-ops will ask you to confirm the submission.</li>
          </ol>
        </section>
      )}
      {actionBtn("email")}
      {actionBtn("contacto")}
      {available.length > 0 && (
        <Button variant="text" size="sm" className={cn(rail && "w-full")} onClick={() => void openDraft(available[0])}>
          <MaterialSymbol name="visibility" size={18} />
          Open latest draft
        </Button>
      )}
      {!rail && <CostBadge kind="spend" size="xs" />}
    </>
  ) : (
    <>
      {showInterview && <Link href={`/pipeline/${n}/interview`} className="md3-btn-outlined flex items-center justify-center gap-2"><MaterialSymbol name="psychology" size={18} />Interview workspace</Link>}
      <GeneratePdfButton n={n} company={company} pdfReady={pdfReady} />
      {actionBtn("cover")}{actionBtn("email")}{actionBtn("contacto")}{applyControl}
    </>
  );

  return (
    <>
      {notice ? (
        <p
          className={cn(
            "md3-alert mb-3",
            notice.tone === "info" && "md3-alert--info",
            notice.tone === "warning" && "md3-alert--warning",
            notice.tone === "success" && "md3-alert--success",
          )}
        >
          {notice.text}
        </p>
      ) : null}

      {rail ? (
        <div className="report-rail-actions flex w-full flex-col gap-1.5">{actions}</div>
      ) : (
        <div className="pipeline-actions md3-actions-row w-full">{actions}</div>
      )}

      {rail ? <CostBadge kind="spend" size="xs" className="mt-0.5" /> : null}

      {panelOpen && draft ? (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            aria-hidden
            onClick={() => setPanelOpen(false)}
          />
          <aside
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={KIND_LABEL[draft.kind]}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] shadow-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-[var(--md-sys-color-outline-variant)] px-4 py-3">
              <h2 className="min-w-0 truncate font-medium text-[var(--md-sys-color-on-surface)]">{KIND_LABEL[draft.kind]}</h2>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void navigator.clipboard.writeText(draft.content);
                    flash("success", "Copied to clipboard");
                  }}
                >
                  Copy
                </Button>
                <Button variant="ghost" size="icon" aria-label="Close draft panel" onClick={() => setPanelOpen(false)}>
                  <MaterialSymbol name="close" size={20} />
                </Button>
              </div>
            </header>
            <div className="flex-1 overflow-y-auto p-4">
              <Badge tone="warn" className="mb-3">
                Draft only — review before sending
              </Badge>
              <p className="mb-4 text-xs text-[var(--md-sys-color-on-surface-variant)]">
                Right-click any action to regenerate. Contacts also appear on Outreach.
              </p>
              <article data-lenis-prevent className="report-prose-compact max-h-[70vh] overflow-y-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft.content}</ReactMarkdown>
              </article>
            </div>
          </aside>
        </>
      ) : null}
    </>
  );
}
