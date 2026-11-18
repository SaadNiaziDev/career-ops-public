"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CompanyLogo } from "@/components/company-logo";
import { MaterialSymbol } from "@/components/material-symbol";
import { SearchTabs } from "@/components/explore/search-tabs";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Skeleton } from "@/components/ui/md3-skeleton";
import { useToast } from "@/components/providers/toast-provider";
import { useJobs, type Job } from "@/components/jobs/job-store";
import { cn } from "@/lib/cn";
import { Kbd, MatchActions, MatchDetail, ScorePill, type MatchAction } from "./match-detail";
import { relativeTime, scoreLabel, sortMatches, sortRecent, ageText, type MatchBucket, type MatchItem, type MatchesSearch } from "./matches-shared";
import styles from "./matches.module.css";

/** Same key the Pipeline inbox triage uses, so a skip here is a skip there. */
const HIDDEN_KEY = "career-ops:hidden";
const ACTIVE_KINDS = new Set(["evaluate", "outreach", "pdf"]);

function readHidden(): string[] {
  try {
    const raw = localStorage.getItem(HIDDEN_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((u): u is string => typeof u === "string") : [];
  } catch {
    return [];
  }
}

function writeHidden(urls: string[]) {
  try {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(urls));
  } catch {
    /* storage unavailable */
  }
}

async function postStatus(n: string, status: string): Promise<string | null> {
  try {
    const res = await fetch("/api/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ n, status }) });
    if (res.ok) return null;
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return data.error || "Could not update the tracker.";
  } catch {
    return "Could not reach the server.";
  }
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const el = target;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || !!el.closest("[role=dialog]");
}

function listJoin(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
}

/* ───────────────────────── left column ───────────────────────── */

function ScannerCard({ search }: { search: MatchesSearch }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const ageMs = search.lastScanAt && now ? now - Date.parse(search.lastScanAt) : null;
  const fresh = ageMs != null && ageMs < 36 * 3_600_000;
  return (
    <div className="rounded-3xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-4">
      <div className="flex items-center gap-3">
        <span className={cn("grid size-9 place-items-center rounded-full", fresh ? "bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)]" : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]")}>
          <MaterialSymbol name="radar" size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            Scanner
            <span className={cn("inline-block size-2 rounded-full", fresh ? cn("bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-primary)]", styles.pulseDot) : "bg-[var(--md-sys-color-tertiary)]")} aria-hidden />
          </p>
          <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {now == null ? "…" : search.lastScanAt ? `Looked ${relativeTime(search.lastScanAt, now)}` : "Hasn't run yet"}
            {search.lastScanAdded != null ? ` · ${search.lastScanAdded} new on the last run` : ""}
          </p>
        </div>
        <Link href="/explore?run=1" className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium text-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container-high)]">
          Scan
        </Link>
      </div>

    </div>
  );
}

function SearchLine({ search }: { search: MatchesSearch }) {
  const shown = search.titles.slice(0, 3);
  const more = search.titles.length - shown.length;
  const where = search.locations.slice(0, 2);
  return (
    <p className="px-1 text-sm leading-relaxed text-[var(--md-sys-color-on-surface-variant)]">
      {shown.length ? (
        <>
          Showing <span className="text-[var(--md-sys-color-on-surface)]">{listJoin(more > 0 ? [...shown, `${more} more`] : shown)}</span> jobs
          {where.length ? <>, in <span className="text-[var(--md-sys-color-on-surface)]">{listJoin(where)}</span></> : null}.{" "}
        </>
      ) : (
        <>No target titles set yet, so every scanned role shows up. </>
      )}
      <Link href="/portals" className="font-medium text-[var(--md-sys-color-primary)] hover:underline">Change search</Link>
    </p>
  );
}

function Tabs({ tab, counts, onChange }: { tab: MatchBucket; counts: Record<MatchBucket, number>; onChange: (t: MatchBucket) => void }) {
  const tabs: { value: MatchBucket; label: string }[] = [
    { value: "new", label: "To review" },
    { value: "skipped", label: "Skipped" },
  ];
  return (
    <div role="tablist" aria-label="Matches" className="grid grid-cols-2 gap-1 rounded-full bg-[var(--md-sys-color-surface-container)] p-1">
      {tabs.map((t) => {
        const active = tab === t.value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-2 text-sm font-medium transition-colors",
              active ? "bg-[var(--md-sys-color-secondary-container)] text-[var(--md-sys-color-on-secondary-container)] shadow-sm" : "text-[var(--md-sys-color-on-surface-variant)] hover:text-[var(--md-sys-color-on-surface)]",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", active ? "bg-[var(--md-sys-color-surface)]/60" : "bg-[var(--md-sys-color-surface-container-highest)]")}>{counts[t.value]}</span>
          </button>
        );
      })}
    </div>
  );
}

function ListRow({ item, active, running, onClick }: { item: MatchItem; active: boolean; running: boolean; onClick: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest" });
  }, [active]);
  const label = scoreLabel(item);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
        styles.rowIn,
        active ? "bg-[var(--md-sys-color-secondary-container)]" : "hover:bg-[var(--md-sys-color-surface-container-high)]",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--md-sys-color-primary)]" aria-hidden />}
      <CompanyLogo name={item.company} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-[var(--md-sys-color-on-surface)]">{item.role}</span>
        <span className="block truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {item.company}
          {item.location ? ` · ${item.location}` : ""}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {running ? (
          <MaterialSymbol name="progress_activity" size={18} className="animate-spin text-[var(--md-sys-color-primary)]" />
        ) : label ? (
          <ScorePill item={item} />
        ) : null}
        <span className="text-[11px] text-[var(--md-sys-color-outline)]">{ageText(item).replace(/^(Posted|Found|Evaluated) /, "")}</span>
      </span>
    </button>
  );
}

/* ───────────────────────── empty + loading ───────────────────────── */

function CaughtUp({ search, skipped, onShowSkipped }: { search: MatchesSearch; skipped: number; onShowSkipped: () => void }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-14 text-center", styles.enter)}>
      <div className={styles.celebrate} aria-hidden>
        <span className={styles.ring} />
        <span className={cn(styles.ring, styles.ring2)} />
        <span className={styles.celebrateCore}>
          <MaterialSymbol name="done_all" size={36} />
        </span>
      </div>
      <h2 className="md-headline-small mt-6 text-[var(--md-sys-color-on-surface)]">You're all caught up.</h2>
      <p className="mt-2 max-w-sm text-sm text-[var(--md-sys-color-on-surface-variant)]">
        {search.lastScanAt ? `The scanner last looked ${relativeTime(search.lastScanAt)}.` : "The scanner hasn't run yet."} Run a scan for fresh roles, or explore further afield.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/explore?run=1" className="md3-action-btn md3-action-btn--filled">
          <MaterialSymbol name="radar" size={18} /> Run free scan
        </Link>
        <Link href="/explore" className="md3-action-btn md3-action-btn--outlined">
          <MaterialSymbol name="explore" size={18} /> Explore
        </Link>
        {skipped > 0 && (
          <button type="button" onClick={onShowSkipped} className="md3-action-btn md3-action-btn--text">
            Review {skipped} skipped
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyTab({ tab }: { tab: MatchBucket }) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-16 text-center", styles.enter)}>
      <MaterialSymbol name={tab === "skipped" ? "visibility_off" : "outgoing_mail"} size={40} className="text-[var(--md-sys-color-outline)]" />
      <p className="mt-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
        {tab === "skipped" ? "Nothing skipped. Roles you skip land here, and you can restore them any time." : "Nothing sent yet. Roles you apply to or write to show up here."}
      </p>
    </div>
  );
}

export function MatchesSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)]" aria-busy="true" aria-label="Loading matches">
      <div className="space-y-4">
        <Md3Skeleton className="h-[116px] w-full rounded-3xl" />
        <Md3Skeleton className="h-4 w-4/5" />
        <Md3Skeleton className="h-12 w-full rounded-full" />
        <div className="hidden space-y-1 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Md3Skeleton className="size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Md3Skeleton className="h-3.5 w-3/4" />
                <Md3Skeleton className="h-3 w-1/2" />
              </div>
              <Md3Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] p-5">
        <div className="flex gap-4">
          <Md3Skeleton className="size-[52px] rounded-xl" />
          <div className="flex-1 space-y-2">
            <Md3Skeleton className="h-3.5 w-28" />
            <Md3Skeleton className="h-6 w-2/3" />
            <Md3Skeleton className="h-3.5 w-1/2" />
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Md3Skeleton className="h-32 w-full rounded-2xl" />
          <Md3Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <div className="mt-6 flex gap-2">
          <Md3Skeleton className="h-11 w-24 rounded-full" />
          <Md3Skeleton className="h-11 w-28 rounded-full" />
          <Md3Skeleton className="h-11 w-32 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── swipe (touch only) ───────────────────────── */

function SwipeCard({ children, onSwipe, rightLabel, leftLabel, disabled }: { children: React.ReactNode; onSwipe: (dir: "left" | "right") => void; rightLabel: string; leftLabel: string; disabled?: boolean }) {
  const [dx, setDx] = useState(0);
  const [settling, setSettling] = useState(false);
  const start = useRef<{ x: number; y: number; id: number; locked: boolean | null } | null>(null);
  const reduce = useRef(false);
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.reduceMotion === "true";
  }, []);

  const down = (e: ReactPointerEvent) => {
    if (disabled || e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("a,button,input,textarea")) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, locked: null };
    setSettling(false);
  };
  const move = (e: ReactPointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.locked === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      s.locked = Math.abs(mx) > Math.abs(my);
      if (s.locked) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.locked) setDx(mx);
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (!s?.locked) return;
    const width = typeof window !== "undefined" ? window.innerWidth : 400;
    const threshold = Math.min(120, width * 0.28);
    setSettling(true);
    if (Math.abs(dx) > threshold) {
      const dir = dx > 0 ? "right" : "left";
      setDx(dir === "right" ? width * 1.2 : -width * 1.2);
      window.setTimeout(() => {
        onSwipe(dir);
        setSettling(false);
        setDx(0);
      }, reduce.current ? 0 : 200);
    } else {
      setDx(0);
    }
  };

  const progress = Math.min(1, Math.abs(dx) / 120);
  return (
    <div
      className={cn(styles.swipe, settling && styles.swipeSettle, "relative")}
      style={dx ? { transform: `translateX(${dx}px) rotate(${reduce.current ? 0 : dx / 28}deg)` } : undefined}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
    >
      {dx < 0 && <span className={cn(styles.stamp, styles.stampLeft)} style={{ opacity: progress }}>{leftLabel}</span>}
      {dx > 0 && <span className={cn(styles.stamp, styles.stampRight)} style={{ opacity: progress }}>{rightLabel}</span>}
      {children}
    </div>
  );
}

/* ───────────────────────── main view ───────────────────────── */

export function MatchesView({ items, search }: { items: MatchItem[]; search: MatchesSearch }) {
  const router = useRouter();
  const { toast, dismiss } = useToast();
  const { jobs, startJob } = useJobs();

  const [hydrated, setHydrated] = useState(false);
  const [hidden, setHidden] = useState<string[]>([]);
  /** Optimistic tracker moves (id → bucket) until the server copy catches up. */
  const [overrides, setOverrides] = useState<Record<string, MatchBucket>>({});
  const [tab, setTab] = useState<MatchBucket>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const lastIndex = useRef(0);
  const lastSkip = useRef<{ item: MatchItem; toastId: string } | null>(null);

  useEffect(() => {
    setHidden(readHidden());
    setHydrated(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === HIDDEN_KEY) setHidden(readHidden());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Drop overrides the server has now confirmed.
  useEffect(() => {
    setOverrides((cur) => {
      const next = { ...cur };
      let changed = false;
      for (const item of items) {
        if (next[item.id] && next[item.id] === item.bucket) {
          delete next[item.id];
          changed = true;
        }
      }
      return changed ? next : cur;
    });
  }, [items]);

  // Re-read files when a worker finishes (evaluation lands in the tracker, outreach drafts appear).
  useEffect(() => {
    const onDone = (e: Event) => {
      const kind = (e as CustomEvent<{ kind?: string }>).detail?.kind;
      if (!kind || ACTIVE_KINDS.has(kind) || kind === "explore-add") router.refresh();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [router]);

  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const bucketOf = useCallback(
    (item: MatchItem): MatchBucket => overrides[item.id] ?? (item.kind === "inbox" && item.bucket === "new" && item.url && hiddenSet.has(item.url) ? "skipped" : item.bucket),
    [overrides, hiddenSet],
  );

  const lists = useMemo(() => {
    const by: Record<MatchBucket, MatchItem[]> = { new: [], skipped: [], sent: [] };
    for (const item of items) by[bucketOf(item)].push(item);
    return { new: sortMatches(by.new), skipped: sortRecent(by.skipped), sent: sortRecent(by.sent) };
  }, [items, bucketOf]);

  const visible = lists[tab];
  const selectedIndex = useMemo(() => {
    const i = visible.findIndex((x) => x.id === selectedId);
    return i >= 0 ? i : Math.min(lastIndex.current, Math.max(0, visible.length - 1));
  }, [visible, selectedId]);
  const selected = visible[selectedIndex] ?? null;
  useEffect(() => {
    lastIndex.current = selectedIndex;
  }, [selectedIndex]);

  const runningFor = useCallback(
    (item: MatchItem): Job[] =>
      jobs.filter((j) => ACTIVE_KINDS.has(j.kind ?? "") && (j.state === "running" || j.state === "queued" || j.status === "running") && !!j.input && (j.input === item.url || j.input === item.n)),
    [jobs],
  );

  const select = useCallback((id: string | null) => setSelectedId(id), []);
  const go = useCallback(
    (delta: number) => {
      if (!visible.length) return;
      const next = Math.max(0, Math.min(visible.length - 1, selectedIndex + delta));
      setSelectedId(visible[next].id);
    },
    [visible, selectedIndex],
  );
  /** Move past the current card (it stays in the list, e.g. while evaluating). */
  const advance = useCallback(() => {
    if (selectedIndex < visible.length - 1) setSelectedId(visible[selectedIndex + 1].id);
  }, [visible, selectedIndex]);

  const moveTo = useCallback(
    async (item: MatchItem, to: MatchBucket): Promise<boolean> => {
      if (item.kind === "inbox" && item.url) {
        const url = item.url;
        const next = to === "skipped" ? [...new Set([...readHidden(), url])] : readHidden().filter((u) => u !== url);
        writeHidden(next);
        setHidden(next);
        return true;
      }
      if (!item.n) return false;
      setOverrides((cur) => ({ ...cur, [item.id]: to }));
      const error = await postStatus(item.n, to === "skipped" ? "SKIP" : "Evaluated");
      if (error) {
        setOverrides((cur) => {
          const next = { ...cur };
          delete next[item.id];
          return next;
        });
        toast({ message: error, tone: "error" });
        return false;
      }
      router.refresh();
      return true;
    },
    [router, toast],
  );

  const undoSkip = useCallback(
    (item: MatchItem) => {
      if (lastSkip.current?.item.id === item.id) {
        dismiss(lastSkip.current.toastId);
        lastSkip.current = null;
      }
      void moveTo(item, "new").then((ok) => {
        if (!ok) return;
        setTab("new");
        setSelectedId(item.id);
      });
    },
    [moveTo, dismiss],
  );

  const skip = useCallback(
    (item: MatchItem) => {
      // Selection falls through to the card now at the same index: the next match.
      lastIndex.current = selectedIndex;
      setSelectedId(null);
      void moveTo(item, "skipped");
      if (lastSkip.current) dismiss(lastSkip.current.toastId);
      const toastId = toast({
        message: `Skipped ${item.company}`,
        tone: "neutral",
        action: { label: "Undo", onClick: () => undoSkip(item) },
      });
      lastSkip.current = { item, toastId };
    },
    [moveTo, toast, dismiss, undoSkip, selectedIndex],
  );

  const restore = useCallback(
    (item: MatchItem) => {
      lastIndex.current = selectedIndex;
      setSelectedId(null);
      void moveTo(item, "new").then((ok) => ok && toast({ message: `${item.company} is back in New`, tone: "neutral" }));
    },
    [moveTo, toast, selectedIndex],
  );

  const act = useCallback(
    (action: MatchAction, item: MatchItem | null = selected) => {
      if (!item) return;
      const bucket = bucketOf(item);
      switch (action) {
        case "skip":
          if (bucket === "new") skip(item);
          return;
        case "restore":
          if (bucket === "skipped") restore(item);
          return;
        case "report":
          if (item.n) router.push(`/pipeline/${item.n}`);
          return;
        case "evaluate": {
          if (item.kind === "evaluated") return act("report", item);
          if (!item.url || runningFor(item).some((j) => j.kind === "evaluate")) return;
          const id = startJob({ title: `Evaluate · ${item.company}`, subtitle: item.role, kind: "evaluate", input: item.url, page: "/explore?view=matches" });
          if (!id) return void toast({ message: "Pick an AI engine in Config first.", tone: "error" });
          toast({ message: `Evaluating ${item.company}. The score lands on this card.`, tone: "neutral" });
          advance();
          return;
        }
        case "outreach":
          router.push(item.n ? `/apply?n=${item.n}#email` : "/apply?view=email");
          return;
        case "write": {
          router.push(item.n ? `/apply?n=${item.n}#email` : "/apply?view=email");
          return;
        }
        case "apply": {
          if (item.kind !== "evaluated" || !item.n) {
            toast({ message: "Evaluate it first, then open Apply to prepare the application.", tone: "neutral" });
            return;
          }
          if (typeof item.score === "number" && item.score < 4 && !window.confirm(`${item.company} scored ${item.score.toFixed(1)}, below 4.0. Open the apply flow anyway?`)) return;
          // The Apply kit for this tracker row: review only, it never submits for you.
          router.push(`/apply?n=${encodeURIComponent(item.n)}`);
          return;
        }
        case "open":
          if (item.url) window.open(item.url, "_blank", "noopener,noreferrer");
          return;
      }
    },
    [selected, bucketOf, skip, restore, router, runningFor, startJob, toast, advance],
  );

  // Keyboard: J/K move, S skip/restore, E evaluate, W write, A apply, O open, U undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      const k = e.key.toLowerCase();
      const map: Record<string, () => void> = {
        j: () => go(1),
        arrowdown: () => go(1),
        k: () => go(-1),
        arrowup: () => go(-1),
        s: () => act(selected && bucketOf(selected) === "skipped" ? "restore" : "skip"),
        e: () => act("evaluate"),
        w: () => act("write"),
        a: () => act("apply"),
        o: () => act("open"),
        u: () => lastSkip.current && undoSkip(lastSkip.current.item),
      };
      const fn = map[k];
      if (!fn) return;
      e.preventDefault();
      fn();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, act, selected, bucketOf, undoSkip]);

  const counts = { new: lists.new.length, skipped: lists.skipped.length, sent: lists.sent.length };
  const changeTab = (t: MatchBucket) => {
    setTab(t);
    setSelectedId(null);
    lastIndex.current = 0;
  };

  const running = selected ? runningFor(selected) : [];
  const selectedBucket = selected ? bucketOf(selected) : tab;
  const primaryRight = selected?.kind === "evaluated" ? "Apply" : "Evaluate";

  return (
    <PageShell width="wide">
      <DossierPageHeader
        title="Search"
        description="Review saved matches, evaluate the strongest roles, then prepare everything in Apply."
        extra={
          <div className="hidden items-center gap-1.5 text-xs text-[var(--md-sys-color-on-surface-variant)] lg:flex">
            <Kbd>J</Kbd>
            <Kbd>K</Kbd>
            <span>to move</span>
          </div>
        }
      />

      <SearchTabs current="saved" />

      {!hydrated ? (
        <MatchesSkeleton />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(18rem,23rem)_minmax(0,1fr)] lg:items-start">
          <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4">
            <div className="hidden flex-col gap-4 lg:flex">
              <ScannerCard search={search} />
              <SearchLine search={search} />
            </div>
            <Tabs tab={tab} counts={counts} onChange={changeTab} />
            {visible.length > 0 && (
              <nav aria-label={`${tab} matches`} className="hidden max-h-[calc(100vh-22rem)] min-h-[12rem] overflow-y-auto overscroll-contain rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] py-1 lg:block">
                {visible.map((item) => (
                  <ListRow key={item.id} item={item} active={selected?.id === item.id} running={runningFor(item).length > 0} onClick={() => select(item.id)} />
                ))}
              </nav>
            )}
          </aside>

          <section className="min-w-0" aria-live="polite">
            {!selected ? (
              <div className="rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)]">
                {tab === "new" ? <CaughtUp search={search} skipped={counts.skipped} onShowSkipped={() => changeTab("skipped")} /> : <EmptyTab tab={tab} />}
              </div>
            ) : (
              <>
                {/* Desktop: detail pane */}
                <div className="hidden rounded-[var(--md-sys-shape-corner-extra-large)] bg-[var(--md-sys-color-surface-container)] p-6 lg:block">
                  <MatchDetail key={selected.id} item={selected} running={running} bucket={selectedBucket} onAction={(a) => act(a)} />
                  <HintBar bucket={selectedBucket} evaluated={selected.kind === "evaluated"} />
                </div>

                {/* Mobile: one swipeable card at a time */}
                <div className="lg:hidden">
                  <div className={styles.stack}>
                    {visible.length - selectedIndex > 1 && <div className={styles.peek} aria-hidden />}
                    {visible.length - selectedIndex > 2 && <div className={cn(styles.peek, styles.peek2)} aria-hidden />}
                    <SwipeCard
                      key={selected.id}
                      disabled={selectedBucket !== "new"}
                      leftLabel="Skip"
                      rightLabel={primaryRight}
                      onSwipe={(dir) => act(dir === "left" ? "skip" : selected.kind === "evaluated" ? "apply" : "evaluate", selected)}
                    >
                      <div className="rounded-[var(--md-sys-shape-corner-extra-large)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-4 shadow-sm">
                        <MatchDetail item={selected} running={running} bucket={selectedBucket} onAction={(a) => act(a)} position={`${selectedIndex + 1} of ${visible.length}`} actions={false} />
                      </div>
                    </SwipeCard>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-2">
                    <button type="button" onClick={() => go(-1)} disabled={selectedIndex === 0} className="md3-action-btn md3-action-btn--text" aria-label="Previous match">
                      <MaterialSymbol name="chevron_left" size={20} /> Prev
                    </button>
                    {selectedBucket === "new" && <p className="text-center text-xs text-[var(--md-sys-color-on-surface-variant)]">Swipe ← skip · {primaryRight.toLowerCase()} →</p>}
                    <button type="button" onClick={() => go(1)} disabled={selectedIndex >= visible.length - 1} className="md3-action-btn md3-action-btn--text" aria-label="Next match">
                      Next <MaterialSymbol name="chevron_right" size={20} />
                    </button>
                  </div>
                </div>
              </>
            )}
            {selected && (
              <div className="fixed inset-x-0 bottom-0 z-[150] border-t border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden">
                <MatchActions item={selected} running={running} bucket={selectedBucket} onAction={(a) => act(a)} compact />
              </div>
            )}
            <div className="mt-6 flex flex-col gap-4 pb-24 lg:hidden">
              <ScannerCard search={search} />
              <SearchLine search={search} />
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}

function HintBar({ bucket, evaluated }: { bucket: MatchBucket; evaluated: boolean }) {
  const hints: [string, string][] = [
    ["J/K", "next / prev"],
    ...(bucket === "new" ? ([["S", "skip"], ["U", "undo"]] as [string, string][]) : bucket === "skipped" ? ([["S", "restore"]] as [string, string][]) : []),
    ["E", evaluated ? "report" : "evaluate"],
    ["W", "email workspace"],
    ...(evaluated ? ([["A", "apply"]] as [string, string][]) : []),
    ["O", "open posting"],
  ];
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--md-sys-color-outline-variant)] pt-4 text-xs text-[var(--md-sys-color-on-surface-variant)]" aria-hidden>
      {hints.map(([k, label]) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          {k.split("/").map((part, i) => (
            <span key={part} className="inline-flex items-center gap-1">
              {i > 0 && <span className="opacity-60">/</span>}
              <Kbd>{part}</Kbd>
            </span>
          ))}
          <span>{label}</span>
        </span>
      ))}
    </div>
  );
}
