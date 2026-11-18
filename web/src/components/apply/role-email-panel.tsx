"use client";

import { useCallback, useEffect, useState } from "react";
import { OutreachDetail } from "@/components/outreach/outreach-view";
import { ActivityComposer } from "@/components/applications/activity-composer";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useJobs } from "@/components/jobs/job-store";
import type { OutreachRecord } from "@/lib/outreach-shared";

export function RoleEmailPanel({ n, company, role }: { n: string; company: string; role: string }) {
  const { jobs, startJob } = useJobs();
  const [items, setItems] = useState<OutreachRecord[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const [outreach, email] = await Promise.all([fetch("/api/outreach"), fetch(`/api/drafts?n=${n}&kind=email`)]);
      if (!outreach.ok) throw new Error("Could not load email records.");
      const data = await outreach.json();
      setItems((data.items as OutreachRecord[]).filter((item) => item.trackerNum === n && item.status !== "dismissed"));
      if (email.ok) setDraft((await email.json()).content || "");
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load email records."); }
  }, [n]);
  useEffect(() => { void refresh(); const done = () => void refresh(); window.addEventListener("co-job-done", done); return () => window.removeEventListener("co-job-done", done); }, [refresh]);
  const running = jobs.some((job) => job.input === n && job.status === "running" && ["outreach", "email"].includes(job.kind || ""));
  function run(kind: string) {
    const id = startJob({ title: `${kind === "email" ? "Application email" : "Hiring contact & email"} · ${company}`, subtitle: role, kind, input: n, page: `/apply?n=${n}#email` });
    if (!id) setError("Choose an AI engine in Config to draft an email.");
  }
  return <section id="email" aria-label="Email for this role" className="scroll-mt-6 space-y-4 rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4 sm:p-5">
    <div><h2 className="md-title-large">Email for this role</h2><p className="mt-1 text-sm text-[var(--md-sys-color-on-surface-variant)]">Prepare and review here. Confirm after sending; the recipient and exact text stay with this application.</p></div>
    <div className="flex flex-wrap gap-2"><Md3ActionButton onClick={() => run("email")} disabled={running} loading={running} cost="spend">Draft application email</Md3ActionButton><Md3ActionButton variant="outlined" onClick={() => run("outreach")} disabled={running} cost="spend">Find contact &amp; draft email</Md3ActionButton></div>
    {items.map((item) => <OutreachDetail key={item.id} item={item} onChange={(next) => setItems((current) => current.map((entry) => entry.id === next.id ? next : entry))} />)}
    {draft && <details><summary className="cursor-pointer text-sm font-medium">Saved application email draft</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{draft}</pre></details>}
    <details><summary className="cursor-pointer text-sm font-medium">Record an email sent outside this workspace</summary><div className="mt-4"><ActivityComposer n={n} initialBody={draft} /></div></details>
    {error && <p role="alert" className="text-sm text-[var(--md-sys-color-error)]">{error}</p>}
  </section>;
}
