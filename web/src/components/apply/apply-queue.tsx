"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Empty } from "@/components/ui/md3-empty";
import { useToast } from "@/components/providers/toast-provider";
import { useJobs } from "@/components/jobs/job-store";
import { readiness, type QueueItem } from "@/lib/apply/kit";

const CONFIG_KEY = "career-ops:config";
const MAX_BATCH = 5;

/**
 * Evaluated roles at 4.0+ that aren't applied yet, with kit readiness at a
 * glance. Select a few and batch-prepare their CVs (and cover letters where the
 * form asks); answers are drafted per kit because they need the live form.
 */
export function ApplyQueue({ initialQueue }: { initialQueue: QueueItem[] }) {
  const { toast } = useToast();
  const { jobs, startJob } = useJobs();
  const [queue, setQueue] = useState(initialQueue);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const refresh = () =>
      fetch("/api/apply/kit", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { queue?: QueueItem[] } | null) => d?.queue && setQueue(d.queue))
        .catch(() => {});
    window.addEventListener("co-job-done", refresh);
    return () => window.removeEventListener("co-job-done", refresh);
  }, []);

  const running = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const j of jobs) {
      if (j.status !== "running" || !j.input || !j.kind) continue;
      map.set(j.input, (map.get(j.input) ?? new Set()).add(j.kind));
    }
    return map;
  }, [jobs]);

  const toggle = (n: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else if (next.size < MAX_BATCH) next.add(n);
      else toast({ message: `Batch up to ${MAX_BATCH} at a time to keep your worker quota sane.`, tone: "error" });
      return next;
    });

  const prepareSelected = () => {
    let cli = false;
    try {
      cli = !!JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}").cliId;
    } catch {
      /* ignore */
    }
    if (!cli) {
      toast({ message: "Pick a CLI in Config first.", tone: "error" });
      return;
    }
    let started = 0;
    for (const item of queue.filter((q) => selected.has(q.app.n))) {
      const busy = running.get(item.app.n);
      if (!item.cvReady && !busy?.has("pdf")) {
        startJob({ title: `CV PDF · ${item.app.company}`, subtitle: "tailored for this role", kind: "pdf", input: item.app.n, page: `/apply?n=${item.app.n}` });
        started++;
      }
      if (!item.coverReady && (item.coverNeed === "required" || item.coverNeed === "optional") && !busy?.has("cover")) {
        startJob({ title: `Cover letter · ${item.app.company}`, subtitle: item.app.role, kind: "cover", input: item.app.n, page: `/apply?n=${item.app.n}` });
        started++;
      }
    }
    setSelected(new Set());
    toast({
      message: started ? `Started ${started} worker${started > 1 ? "s" : ""}. Open each kit to draft its form answers.` : "Those kits already have their CV and cover letter.",
      tone: "neutral",
    });
  };

  if (queue.length === 0) {
    return (
      <Md3Empty icon="task_alt" description="No evaluated roles at 4.0+ waiting to be applied to.">
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/pipeline" className="md3-action-btn md3-action-btn--outlined">
            <span className="md3-action-btn__label">Open pipeline</span>
          </Link>
          <Link href="/explore" className="md3-action-btn md3-action-btn--text">
            <span className="md3-action-btn__label">Find more roles</span>
          </Link>
        </div>
      </Md3Empty>
    );
  }

  return (
    <section aria-labelledby="queue-title" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="queue-title" className="mr-auto text-base font-semibold text-[var(--md-sys-color-on-surface)]">
          Ready to apply <span className="font-normal text-[var(--md-sys-color-on-surface-variant)]">· {queue.length} at 4.0+</span>
        </h2>
        {selected.size > 0 && (
          <Md3ActionButton variant="text" onClick={() => setSelected(new Set())}>
            Clear
          </Md3ActionButton>
        )}
        <Md3ActionButton variant="filled" icon="bolt" onClick={prepareSelected} disabled={selected.size === 0} cost="spend">
          {selected.size ? `Prepare ${selected.size}` : "Select to prepare"}
        </Md3ActionButton>
      </div>

      <ul className="co-kit-card">
        {queue.map((item) => {
          const r = readiness(item);
          const busy = running.get(item.app.n);
          const coverApplies = item.coverNeed === "required" || item.coverNeed === "optional";
          const checked = selected.has(item.app.n);
          return (
            <li key={item.app.n} className="co-kit-row">
              <input
                type="checkbox"
                className="size-5 accent-[var(--md-sys-color-primary)]"
                checked={checked}
                onChange={() => toggle(item.app.n)}
                aria-label={`Select ${item.app.company} ${item.app.role} for batch prepare`}
              />
              <CompanyLogo name={item.app.company} size={32} className="rounded-lg" />
              <Link href={`/apply?n=${item.app.n}`} className="group grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[var(--md-sys-color-primary)]">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-[var(--md-sys-color-on-surface)] group-hover:underline">{item.app.role}</span>
                  <span className="block truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
                    #{item.app.n} · {item.app.company}
                  </span>
                </span>
                <Badge tone="good" className="justify-self-end">{item.app.score.toFixed(1)}</Badge>
                <span className="col-span-2 flex flex-wrap items-center gap-1">
                  <Pill on={item.cvReady} run={busy?.has("pdf")} label="CV" />
                  <Pill on={item.answered > 0} run={false} label={item.total ? `Answers ${item.answered}/${item.total}` : "Answers"} />
                  {coverApplies && <Pill on={item.coverReady} run={busy?.has("cover")} label="Cover" />}
                  <span className="ml-auto inline-flex items-center gap-0.5 text-xs text-[var(--md-sys-color-primary)]">
                    {r.done === r.total ? "Ready" : `${r.done}/${r.total}`} <MaterialSymbol name="chevron_right" size={16} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="px-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
        Batch prepare writes CVs and cover letters in parallel. Form answers need the live application form, so they are drafted when you open each kit.
      </p>
    </section>
  );
}

function Pill({ on, run, label }: { on: boolean; run?: boolean; label: string }) {
  return (
    <span className="co-kit-pill" data-on={on} data-run={!!run && !on}>
      <MaterialSymbol name={run && !on ? "progress_activity" : on ? "check" : "radio_button_unchecked"} size={12} className={run && !on ? "animate-spin" : ""} />
      {label}
    </span>
  );
}
