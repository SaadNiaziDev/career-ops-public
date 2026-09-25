"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MaterialSymbol } from "@/components/material-symbol";
import { Button } from "@/components/ui/button";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { cn } from "@/lib/cn";
import { instrumentSerif } from "@/lib/fonts";
import { parseReport, scoreTone, legitimacyTone } from "@/lib/format";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { usePipeline } from "@/components/pipeline/pipeline-provider";
import { firstScoreSeenKey, resolveFirstScoreIdentity, selectSessionEvaluation } from "@/lib/jobs/first-score-policy";

const STYLE = `
.co-aha{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:1.2rem;background:color-mix(in srgb, var(--md-sys-color-surface) 70%, rgba(0,0,0,.5));-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);animation:co-aha-in .35s ease both}
.co-aha__card{position:relative;width:min(34rem,100%);border-radius:var(--md-sys-shape-corner-extra-large);border:1px solid var(--md-sys-color-outline-variant);background:var(--md-sys-color-surface);box-shadow:0 24px 70px -20px rgba(0,0,0,.5);overflow:hidden}
.co-aha__glow{position:absolute;inset:0;background:radial-gradient(80% 60% at 50% -10%, color-mix(in srgb, var(--md-sys-color-primary) 22%, transparent), transparent 70%);pointer-events:none}
.co-aha__grade{font-variant-numeric:tabular-nums;line-height:1}
@keyframes co-aha-in{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.co-aha{animation:none}}
`;

function extractWhy(job: Job): string {
  const s = (job.result?.summary || "").trim();
  if (s.length > 30) return s.replace(/\.$/, "") + ".";
  const body = parseReport(job.text || "").body;
  const para = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/[#*>`-]/g, "").replace(/\s+/g, " ").trim())
    .find((p) => p.length > 60 && /\b(you|your|fit|match|strong|experience|background)\b/i.test(p));
  return para ? para.slice(0, 240) : "You're a strong match for this role — open the full report for the breakdown.";
}

export function FirstScoreView() {
  const router = useRouter();
  const { jobs, completedEvaluationId } = useJobs();
  const { applications } = usePipeline();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [seenState, setSeenState] = useState<{ key: string | null; seen: boolean }>({ key: null, seen: true });

  const firstDone = useMemo(() => selectSessionEvaluation(jobs, completedEvaluationId), [jobs, completedEvaluationId]);
  const identity = useMemo(
    () => (firstDone ? resolveFirstScoreIdentity(firstDone, applications) : null),
    [firstDone, applications],
  );
  const seenKey = firstDone ? firstScoreSeenKey(firstDone.id) : null;

  useEffect(() => {
    if (!seenKey) {
      setSeenState({ key: null, seen: true });
      return;
    }
    try {
      setSeenState({ key: seenKey, seen: localStorage.getItem(seenKey) === "1" });
    } catch {
      setSeenState({ key: seenKey, seen: false });
    }
  }, [seenKey]);

  const panelRef = useRef<HTMLDivElement>(null);
  const open = !!firstDone && !!identity && !!seenKey && seenState.key === seenKey && !seenState.seen && dismissedKey !== seenKey;

  const close = useCallback(() => {
    if (!seenKey) return;
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      /* ignore */
    }
    setSeenState({ key: seenKey, seen: true });
    setDismissedKey(seenKey);
  }, [seenKey]);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>("a, button")?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const f = panelRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      prev?.focus?.();
    };
  }, [open, close]);

  if (!open || !firstDone || !identity) return null;

  const why = extractWhy(firstDone);
  const score = firstDone.result?.score ?? null;
  const meta = parseReport(firstDone.text || "");
  const legit = meta.legitimacy;
  const company = identity.company;
  const role = identity.role;
  const tone = score != null ? scoreTone(`${score}`) : "muted";

  return (
    <div className="co-aha" role="dialog" aria-modal="true" aria-label="Your first score" onClick={close}>
      <style>{STYLE}</style>
      <div ref={panelRef} className="co-aha__card" onClick={(e) => e.stopPropagation()}>
        <div className="co-aha__glow" />
        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-[var(--md-sys-color-outline)] transition hover:text-[var(--md-sys-color-on-surface)]"
        >
          <MaterialSymbol name="close" size={20} />
        </button>

        <div className="relative px-7 pb-7 pt-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--md-sys-color-primary)]">
            <span className="text-[var(--md-sys-color-outline)]">//</span> the job we found you — scored
          </p>

          <div className="mt-4 flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className={`${instrumentSerif.className} truncate text-2xl leading-tight text-[var(--md-sys-color-on-surface)]`}>{role || company}</h2>
              {role && <p className="truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">{company}</p>}
            </div>
            {score != null && (
              <div className="shrink-0 text-right">
                <div
                  className={cn(
                    "co-aha__grade text-5xl font-semibold",
                    tone === "good"
                      ? "text-[var(--md-sys-color-tertiary)]"
                      : tone === "warn"
                        ? "text-[var(--md-sys-color-tertiary)]"
                        : tone === "bad"
                          ? "text-[var(--md-sys-color-error)]"
                          : "text-[var(--md-sys-color-on-surface-variant)]",
                  )}
                >
                  {score}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-[var(--md-sys-color-outline)]">/ 5 fit</div>
              </div>
            )}
          </div>

          <blockquote className={`${instrumentSerif.className} mt-5 border-l-2 border-[color-mix(in_srgb,var(--md-sys-color-primary)_40%,transparent)] pl-4 text-[19px] leading-snug text-[var(--md-sys-color-on-surface)]`}>
            <MaterialSymbol name="auto_awesome" size={16} className="mb-1 inline text-[var(--md-sys-color-primary)]" /> {why}
          </blockquote>

          {legit && (
            <div
              className={cn(
                "mt-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                legitimacyTone(legit) === "good"
                  ? "border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_30%,transparent)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
                  : "border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_30%,transparent)] bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
              )}
            >
              <MaterialSymbol name="verified_user" size={12} /> Legitimacy: {legit}
            </div>
          )}

          <p className="mt-5 flex items-center gap-1.5 text-[12px] text-[var(--md-sys-color-outline)]">
            <MaterialSymbol name="paid" size={14} /> That ran on your own AI. Everything before it — finding this job — was free.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <Md3ActionButton
              variant="filled"
              icon="description"
              onClick={() => {
                close();
                router.push(identity.href);
              }}
            >
              See the full report
            </Md3ActionButton>
            <Button
              variant="outline"
              onClick={() => {
                close();
                router.push("/explore");
              }}
            >
              <MaterialSymbol name="explore" size={18} />
              Find more like this
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
