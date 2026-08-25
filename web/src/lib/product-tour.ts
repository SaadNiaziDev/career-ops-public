import type { Step } from "react-joyride";

export type TourPhaseId =
  | "onboarding"
  | "dashboard"
  | "explore"
  | "pipeline"
  | "add-job"
  | "apply"
  | "cv"
  | "portals"
  | "outreach"
  | "analytics"
  | "config";

export type TourPhase = {
  id: TourPhaseId;
  route: string;
  label: string;
  /** Human-readable “what you do here” for docs / last-step CTA */
  summary: string;
  next?: { phase: TourPhaseId; route: string; label: string };
  steps: Step[];
};

export const TOUR_STORAGE = {
  completed: "career-ops:tour-completed",
  active: "career-ops:tour-active",
  /** @deprecated merged into completed — kept for back-compat reads */
  legacyOnboarding: "career-ops:onboarding-tour",
} as const;

/** End-to-end job search loop — order matters. */
export const TOUR_SEQUENCE: TourPhaseId[] = [
  "onboarding",
  "dashboard",
  "explore",
  "pipeline",
  "add-job",
  "apply",
  "cv",
  "portals",
  "outreach",
  "analytics",
  "config",
];

export const TOUR_PHASES: Record<TourPhaseId, TourPhase> = {
  onboarding: {
    id: "onboarding",
    route: "/",
    label: "Setup",
    summary: "Connect your AI CLI and create cv.md from a PDF, .md file, or paste.",
    next: { phase: "dashboard", route: "/", label: "Today dashboard" },
    steps: [
      {
        target: "[data-co-tour='welcome']",
        title: "Welcome to career-ops",
        content: "Everything runs locally on your machine. First we connect an AI CLI, then turn your résumé into cv.md.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='cli']",
        title: "Pick your AI CLI",
        content: "Claude Code, Codex, or Cursor Agent score jobs, polish PDFs, and run scan/evaluate workers. Skip if you only paste or use .md.",
        placement: "top",
      },
      {
        target: "[data-co-tour='cv']",
        title: "Add your CV",
        content: "Drop a PDF or .md, or paste text. Review the markdown before saving — nothing writes until you confirm.",
        placement: "top",
      },
    ],
  },
  dashboard: {
    id: "dashboard",
    route: "/",
    label: "Today",
    summary: "Your daily action queue — fresh matches, follow-ups, and roles awaiting a decision.",
    next: { phase: "explore", route: "/explore", label: "Explore & scan" },
    steps: [
      {
        target: "[data-co-tour='nav-rail']",
        title: "Navigation",
        content: "The rail is your map: Today, Add job, Explore, Pipeline, Outreach, Portals, Analytics, CV, and Config.",
        disableBeacon: true,
        placement: "right",
      },
      {
        target: "[data-co-tour='today-hero']",
        title: "Today's action queue",
        content: "Work top to bottom — follow-ups, scored roles waiting on you, and fresh matches from free scans.",
        placement: "bottom",
      },
      {
        target: "[data-co-tour='today-stats']",
        title: "At a glance",
        content: "New this week, follow-ups due, roles awaiting your apply/skip decision, and total tracked applications.",
        placement: "bottom",
      },
      {
        target: "[data-co-tour='workers']",
        title: "Background workers",
        content: "Evaluations, PDFs, and scans run here via your CLI. Open the sheet to watch progress or cancel a job.",
        placement: "left",
      },
    ],
  },
  explore: {
    id: "explore",
    route: "/explore",
    label: "Explore",
    summary: "Free portal scans (zero tokens) or AI-powered hunts — add matches to your pipeline inbox.",
    next: { phase: "pipeline", route: "/pipeline", label: "Pipeline inbox" },
    steps: [
      {
        target: "[data-co-tour='explore-modes']",
        title: "Two discovery modes",
        content: "Scan runs free against portals.yml (no AI tokens). AI Hunt uses your CLI for natural-language search on the open web.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='explore-filters']",
        title: "Scan filters",
        content: "Title keywords come from your CV and portals.yml. Refine location and role filters, then run a scan.",
        placement: "bottom",
      },
      {
        target: "[data-co-tour='explore-results']",
        title: "Results → pipeline",
        content: "Each card shows fit score and source. Add promising roles to your pipeline inbox for triage.",
        placement: "top",
      },
    ],
  },
  pipeline: {
    id: "pipeline",
    route: "/pipeline",
    label: "Pipeline",
    summary: "Triage inbox URLs, track application stages, and open evaluation reports.",
    next: { phase: "add-job", route: "/add", label: "Add a job link" },
    steps: [
      {
        target: "[data-co-tour='pipeline-tabs']",
        title: "Inbox & stages",
        content: "Inbox holds unscored URLs. After evaluation, roles move through Evaluated → Applied → Interview → Offer.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='pipeline-inbox']",
        title: "Triage inbox",
        content: "Batch-evaluate pending links, discard noise, or open a posting. Facet chips filter by fit, location, and freshness.",
        placement: "top",
      },
      {
        target: "[data-co-tour='pipeline-board']",
        title: "Board & table",
        content: "Switch views to scan your funnel. Update status, open reports, or jump to Apply for a scored role.",
        placement: "top",
      },
    ],
  },
  "add-job": {
    id: "add-job",
    route: "/add",
    label: "Add job",
    summary: "Paste any job URL — auto-pipeline evaluates it, writes a report, and adds a tracker row.",
    next: { phase: "apply", route: "/apply", label: "Apply assist" },
    steps: [
      {
        target: "[data-co-tour='add-job-hub']",
        title: "Paste a job URL",
        content: "Drop a careers or ATS link. career-ops verifies the posting, scores it A–F against your CV, and generates a report + tailored PDF.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='add-job-actions']",
        title: "Evaluate or queue",
        content: "Evaluate now (spawns a CLI worker), add to inbox for later, or hunt similar roles on the web.",
        placement: "top",
      },
    ],
  },
  apply: {
    id: "apply",
    route: "/apply",
    label: "Apply",
    summary: "Reads the real application form locally, pre-fills from your CV — you verify and submit yourself.",
    next: { phase: "cv", route: "/cv", label: "CV studio" },
    steps: [
      {
        target: "[data-co-tour='apply-intro']",
        title: "Application assist",
        content: "Paste an application URL. We read the form on your machine, draft answers from cv.md, and fill fields after you approve. Never auto-submits.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='apply-form']",
        title: "Verify every field",
        content: "Review each answer in plain language. Edit anything before the worker fills the live form — you click Submit.",
        placement: "top",
      },
    ],
  },
  cv: {
    id: "cv",
    route: "/cv",
    label: "CV",
    summary: "Edit cv.md, preview the studio layout, and export a tailored PDF for applications.",
    next: { phase: "portals", route: "/portals", label: "Portal scanner" },
    steps: [
      {
        target: "[data-co-tour='cv-editor']",
        title: "CV studio",
        content: "cv.md is the single source of truth for every generated draft. Edit here; evaluations and PDFs read this file.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='cv-export']",
        title: "Export PDF",
        content: "Generate a styled PDF from your markdown template. Tailored variants are created per role during auto-pipeline.",
        placement: "top",
      },
    ],
  },
  portals: {
    id: "portals",
    route: "/portals",
    label: "Portals",
    summary: "Configure portals.yml — companies to scan, title keywords, and location filters.",
    next: { phase: "outreach", route: "/contacts", label: "Outreach" },
    steps: [
      {
        target: "[data-co-tour='portals-hero']",
        title: "Portal scanner config",
        content: "portals.yml controls free scans: tracked companies, search queries, title_filter.positive, and location gates.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='portals-list']",
        title: "Companies & health",
        content: "Add employers, fix broken ATS links, and tune which boards career-ops watches — all edits stay local.",
        placement: "top",
      },
    ],
  },
  outreach: {
    id: "outreach",
    route: "/contacts",
    label: "Outreach",
    summary: "Track recruiters and hiring managers — outreach status, LinkedIn links, and notes per application.",
    next: { phase: "analytics", route: "/analytics", label: "Analytics" },
    steps: [
      {
        target: "[data-co-tour='outreach-intro']",
        title: "Contacts & outreach",
        content: "People tied to your applications — recruiters, hiring managers, peers. Saved from reports via Find contacts; grouped by company.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='outreach-filters']",
        title: "Filter & search",
        content: "Search by name or company. Filter by channel, contact type, verified email, and outreach status (messaged, replied, ghosted).",
        placement: "bottom",
      },
      {
        target: "[data-co-tour='outreach-list']",
        title: "Track every touch",
        content: "Update outreach status per contact. Links back to the pipeline report. Use contacto mode in your CLI to draft LinkedIn messages.",
        placement: "top",
      },
    ],
  },
  analytics: {
    id: "analytics",
    route: "/analytics",
    label: "Analytics",
    summary: "Funnel stats, score distribution, dimension trends, and learning signals from your tracker.",
    next: { phase: "config", route: "/config", label: "Config & engines" },
    steps: [
      {
        target: "[data-co-tour='analytics-hero']",
        title: "Search analytics",
        content: "Retrospective on your pipeline — export CSV, average scores, interviews, and offers across all tracked evaluations.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='analytics-stats']",
        title: "Headline metrics",
        content: "Evaluated count, average score, interviews, and offers at a glance. Empty until you evaluate roles.",
        placement: "bottom",
      },
      {
        target: "[data-co-tour='analytics-stages']",
        title: "Funnel & learning",
        content: "Stage breakdown, score distribution, and dimension trends. After 5+ outcomes, scan ranking adjusts toward what gets replies.",
        placement: "top",
      },
    ],
  },
  config: {
    id: "config",
    route: "/config",
    label: "Config",
    summary: "CLI engines, API keys, profile.yml, scoring weights, and appearance.",
    steps: [
      {
        target: "[data-co-tour='config-cli']",
        title: "Engines & keys",
        content: "Pick Claude Code, Codex, or Cursor Agent. Set timeouts, worker concurrency, and provider keys for AI Hunt.",
        disableBeacon: true,
        placement: "bottom",
      },
      {
        target: "[data-co-tour='config-profile']",
        title: "Profile & targeting",
        content: "config/profile.yml holds comp targets, location policy, and spend tier. modes/_profile.md holds your narrative and archetypes.",
        placement: "top",
      },
      {
        target: "[data-co-tour='config-tour-restart']",
        title: "Tour complete",
        content: "You're set. Restart this tour anytime from Config. Paste job URLs on Add job or scan Explore to start searching.",
        placement: "top",
      },
    ],
  },
};

export function readCompletedPhases(): TourPhaseId[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TOUR_STORAGE.completed);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed.filter((x) => typeof x === "string") as TourPhaseId[]) : [];
  } catch {
    return [];
  }
}

export function writeCompletedPhases(phases: TourPhaseId[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOUR_STORAGE.completed, JSON.stringify(phases));
}

export function markPhaseComplete(id: TourPhaseId): TourPhaseId[] {
  const prev = new Set(readCompletedPhases());
  prev.add(id);
  const next = TOUR_SEQUENCE.filter((p) => prev.has(p));
  writeCompletedPhases(next);
  try {
    localStorage.setItem(TOUR_STORAGE.active, "1");
    window.dispatchEvent(new CustomEvent("co-tour-changed"));
  } catch {
    /* ignore */
  }
  return next;
}

export function resetProductTour(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOUR_STORAGE.completed);
  localStorage.removeItem(TOUR_STORAGE.active);
  localStorage.removeItem(TOUR_STORAGE.legacyOnboarding);
  try {
    window.dispatchEvent(new CustomEvent("co-tour-changed"));
  } catch {
    /* ignore */
  }
}

export function isTourActive(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(TOUR_STORAGE.active) === "1";
  } catch {
    return false;
  }
}

export function phaseForPath(pathname: string): TourPhaseId | null {
  if (pathname === "/") return "dashboard";
  const match = TOUR_SEQUENCE.find((id) => {
    if (id === "onboarding" || id === "dashboard") return false;
    const route = TOUR_PHASES[id].route;
    return pathname === route || pathname.startsWith(`${route}/`);
  });
  return match ?? null;
}

/** Which phase should auto-run on this path (respects sequence + completion). */
export function resolveRunnablePhase(pathname: string, hasCv: boolean, onboardingScreen: boolean): TourPhaseId | null {
  if (onboardingScreen || !hasCv) {
    const done = readCompletedPhases();
    if (!done.includes("onboarding")) return "onboarding";
    return null;
  }
  if (pathname === "/") {
    const done = readCompletedPhases();
    if (!done.includes("dashboard") && done.includes("onboarding")) return "dashboard";
    return null;
  }
  const phase = phaseForPath(pathname);
  if (!phase) return null;
  const done = new Set(readCompletedPhases());
  if (done.has(phase)) return null;
  const idx = TOUR_SEQUENCE.indexOf(phase);
  if (idx <= 0) return null;
  const prev = TOUR_SEQUENCE[idx - 1];
  if (!done.has(prev)) return null;
  if (!isTourActive() && phase !== "dashboard") return null;
  return phase;
}

export function tourProgress(): { done: number; total: number; label: string } {
  const done = readCompletedPhases().length;
  return { done, total: TOUR_SEQUENCE.length, label: `${done}/${TOUR_SEQUENCE.length} sections` };
}
