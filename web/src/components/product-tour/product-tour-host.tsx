"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Joyride, { type CallBackProps, STATUS } from "react-joyride";
import {
  TOUR_PHASES,
  markPhaseComplete,
  resolveRunnablePhase,
  type TourPhase,
  type TourPhaseId,
} from "@/lib/product-tour";

function lastStepContent(phase: TourPhase): string {
  const last = phase.steps[phase.steps.length - 1];
  const base = typeof last.content === "string" ? last.content : "";
  if (!phase.next) return base;
  return `${base} Next up: ${phase.next.label} (${phase.next.route}).`;
}

function stepsWithNextHint(phase: TourPhase) {
  return phase.steps.map((s, i) =>
    i === phase.steps.length - 1 && phase.next ? { ...s, content: lastStepContent(phase) } : s,
  );
}

export function ProductTourHost() {
  const pathname = usePathname();
  const router = useRouter();
  const [hasCv, setHasCv] = useState<boolean | null>(null);
  const [phaseId, setPhaseId] = useState<TourPhaseId | null>(null);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const onboardingScreen = pathname === "/" && hasCv === false;

  useEffect(() => {
    fetch("/api/cv")
      .then((r) => r.json())
      .then((d: { exists?: boolean }) => setHasCv(!!d.exists))
      .catch(() => setHasCv(false));
  }, [pathname]);

  useEffect(() => {
    const onCvSaved = () => setHasCv(true);
    window.addEventListener("co-cv-saved", onCvSaved);
    return () => window.removeEventListener("co-cv-saved", onCvSaved);
  }, []);

  useEffect(() => {
    if (hasCv === null) return;
    const id = resolveRunnablePhase(pathname, hasCv, onboardingScreen);
    setPhaseId(id);
    setRun(!!id);
    setStepIndex(0);
  }, [pathname, hasCv, onboardingScreen]);

  const phase = phaseId ? TOUR_PHASES[phaseId] : null;
  const steps = useMemo(() => (phase ? stepsWithNextHint(phase) : []), [phase]);

  useEffect(() => {
    if (phaseId !== "onboarding") return;
    window.dispatchEvent(new CustomEvent("co-tour-onboarding-step", { detail: { index: stepIndex } }));
  }, [phaseId, stepIndex]);

  useEffect(() => {
    if (phaseId !== "config" || !run) return;
    const section = stepIndex === 0 ? "engines" : stepIndex === 1 ? "profile" : "data";
    window.dispatchEvent(new CustomEvent("co-config-goto", { detail: { section } }));
  }, [phaseId, stepIndex, run]);

  useEffect(() => {
    if (phaseId !== "pipeline" || !run) return;
    if (stepIndex === 1) window.dispatchEvent(new CustomEvent("co-tour-goto", { detail: { href: "/pipeline?tab=INBOX" } }));
    if (stepIndex === 2) window.dispatchEvent(new CustomEvent("co-tour-goto", { detail: { href: "/pipeline?tab=ALL" } }));
  }, [phaseId, stepIndex, run]);

  useEffect(() => {
    const onGoto = (e: Event) => {
      const href = (e as CustomEvent<{ href?: string }>).detail?.href;
      if (href) router.push(href);
    };
    window.addEventListener("co-tour-goto", onGoto);
    return () => window.removeEventListener("co-tour-goto", onGoto);
  }, [router]);

  const finish = useCallback(
    (skipped: boolean) => {
      if (!phaseId) return;
      setRun(false);
      if (phaseId === "onboarding" && !hasCv) return;
      markPhaseComplete(phaseId);
      if (skipped || !phase?.next) return;
      router.push(phase.next.route);
    },
    [phase, phaseId, hasCv, router],
  );

  const onCallback = useCallback(
    (data: CallBackProps) => {
      if (data.type === "step:after" && data.action === "next") setStepIndex(data.index + 1);
      if (data.status === STATUS.FINISHED) finish(false);
      if (data.status === STATUS.SKIPPED) finish(true);
    },
    [finish],
  );

  if (!phase || steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      showProgress
      showSkipButton
      scrollToFirstStep
      disableOverlayClose
      callback={onCallback}
      styles={{ options: { zIndex: 10000, primaryColor: "var(--md-sys-color-primary)" } }}
      locale={{
        back: "Back",
        close: "Close",
        last: phase.next ? `Continue → ${phase.next.label}` : "Done",
        next: "Next",
        skip: "Skip section",
      }}
    />
  );
}

/** Compact progress + restart control for Config. */
export function ProductTourControls() {
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(11);

  useEffect(() => {
    const refresh = () => {
      import("@/lib/product-tour").then((m) => {
        const p = m.tourProgress();
        setDone(p.done);
        setTotal(p.total);
      });
    };
    refresh();
    window.addEventListener("co-tour-changed", refresh);
    return () => window.removeEventListener("co-tour-changed", refresh);
  }, []);

  const reset = () => {
    import("@/lib/product-tour").then((m) => {
      m.resetProductTour();
      setDone(0);
      window.dispatchEvent(new CustomEvent("co-tour-changed"));
    });
  };

  return (
    <div data-co-tour="config-tour-restart" className="rounded-[var(--md-sys-shape-corner-large)] border border-[var(--md-sys-color-outline-variant)] p-4">
      <p className="text-sm font-medium text-[var(--md-sys-color-on-surface)]">Product tour</p>
      <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">
        {done === 0
          ? "Walk through every major screen — setup through Config, including Outreach and Analytics."
          : `${done} of ${total} sections completed. Open any page you have not toured yet to continue.`}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="md3-btn-outlined px-3 py-1.5 text-xs" onClick={reset}>
          Restart full tour
        </button>
        <Link href="/" className="md3-btn-text px-3 py-1.5 text-xs">
          Start from Today
        </Link>
      </div>
    </div>
  );
}
