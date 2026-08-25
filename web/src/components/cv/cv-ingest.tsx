"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Textarea } from "@/components/ui/md3-input";
import { cn } from "@/lib/cn";
import { instrumentSerif } from "@/lib/fonts";
import { cvReadiness, parseCvStream, seedFromCvMarkdown, type CvSeed } from "@/lib/cv/quality";
import { cliDisplayName, resolveCliIdForRun } from "@/lib/cli-config";
import { markPhaseComplete } from "@/lib/product-tour";

type Phase = "input" | "parsing" | "review" | "saving" | "error";

const STYLE = `
.co-cvdrop{position:relative;border:1.5px dashed color-mix(in srgb, var(--md-sys-color-outline) 55%, transparent);border-radius:var(--md-sys-shape-corner-extra-large);transition:border-color .2s,background .2s}
.co-cvdrop[data-over="true"]{border-color:var(--md-sys-color-primary);background:color-mix(in srgb, var(--md-sys-color-primary) 5%, transparent)}
.co-cvtrace{animation:co-rise .4s ease both}
@keyframes co-rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
`;

export function CvIngest({
  onSaved,
  afterSave = "home",
  cliId: cliIdProp = null,
}: {
  onSaved?: () => void;
  afterSave?: "home" | "stay";
  cliId?: string | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("input");
  const [paste, setPaste] = useState("");
  const [over, setOver] = useState(false);
  const [trace, setTrace] = useState("");
  const [md, setMd] = useState("");
  const [seed, setSeed] = useState<CvSeed | null>(null);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const readiness = md ? cvReadiness(md) : null;

  const runStream = useCallback(async (init: RequestInit, explicitCliId?: string | null) => {
    setPhase("parsing");
    setTrace("Reading your CV…");
    setErr("");
    const resolvedCli = explicitCliId ?? cliIdProp ?? (await resolveCliIdForRun());
    setActiveCliLabel(resolvedCli ? (cliDisplayName(resolvedCli) ?? resolvedCli) : null);
    try {
      let reqInit = init;
      if (resolvedCli) {
        const headers = new Headers(init.headers);
        if (init.body instanceof FormData) {
          const form = new FormData();
          for (const [k, v] of init.body.entries()) form.append(k, v);
          form.set("cliId", resolvedCli);
          reqInit = { ...init, body: form };
        } else if (typeof init.body === "string") {
          try {
            const parsed = JSON.parse(init.body) as Record<string, unknown>;
            reqInit = { ...init, body: JSON.stringify({ ...parsed, cliId: resolvedCli }) };
          } catch {
            reqInit = init;
          }
        }
      }
      const r = await fetch("/api/cv/ingest", reqInit);
      const ctype = r.headers.get("content-type") || "";
      if (ctype.includes("application/json")) {
        const d = (await r.json().catch(() => ({}))) as { error?: string };
        if (r.status === 404) {
          setErr("needs-cli");
        } else {
          setErr(d.error || "Couldn't parse the CV — paste the text instead.");
        }
        setPhase("error");
        return;
      }
      if (!r.body) {
        setErr("No response.");
        setPhase("error");
        return;
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parsed = parseCvStream(buf);
        if (parsed.error) {
          setErr(parsed.error === "unreadable" ? "I couldn't read text from that file (it may be a scanned image). Paste the text instead." : "Couldn't parse the CV — paste the text instead.");
          setPhase("error");
          return;
        }
        if (parsed.trace) setTrace(parsed.trace.split("\n").filter(Boolean).slice(-1)[0] || "Reading your CV…");
        if (parsed.markdown) setMd(parsed.markdown);
        if (parsed.seed) setSeed(parsed.seed);
      }
      const final = parseCvStream(buf);
      if (!final.markdown.trim()) {
        setErr("Couldn't read a CV there — paste the text instead.");
        setPhase("error");
        return;
      }
      setMd(final.markdown);
      setSeed(final.seed);
      setPhase("review");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "stream error");
      setPhase("error");
    }
  }, [cliIdProp]);

  const ingestText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMd(trimmed);
    setSeed(seedFromCvMarkdown(trimmed));
    setPhase("review");
  };

  const ingestFile = (file: File) => {
    if (/\.(md|markdown|txt)$/i.test(file.name)) {
      file
        .text()
        .then((t) => {
          if (!t.trim()) {
            setErr("That file looks empty — paste your CV instead.");
            setPhase("error");
            return;
          }
          ingestText(t.trim());
        })
        .catch(() => {
          setErr("Couldn't read that file — paste your CV instead.");
          setPhase("error");
        });
      return;
    }
    const form = new FormData();
    form.append("file", file);
    void runStream({ method: "POST", body: form });
  };

  const [saveErr, setSaveErr] = useState("");
  const [activeCliLabel, setActiveCliLabel] = useState<string | null>(null);
  const save = async () => {
    if (!md.trim()) {
      setSaveErr("Your CV looks empty — paste it again.");
      return;
    }
    setSaveErr("");
    setPhase("saving");
    try {
      const r = await fetch("/api/cv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: md }) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSaveErr(d.error || "Couldn't save your CV — try again.");
        setPhase("review");
        return;
      }
    } catch {
      setSaveErr("Couldn't save your CV — check your connection and try again.");
      setPhase("review");
      return;
    }
    const merged: CvSeed = { ...seedFromCvMarkdown(md), ...(seed || {}) };
    const roles = merged.roles?.length ? merged.roles : merged.title ? [merged.title] : [];
    try {
      await fetch("/api/doctor");
    } catch {
      /* auto-copy templates */
    }
    if (merged.name || merged.email || merged.location || roles.length) {
      try {
        await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: merged.name,
            email: merged.email,
            location: merged.location,
            roles: roles.length ? roles : undefined,
          }),
        });
      } catch {
        /* best-effort */
      }
    }
    if (roles.length) {
      try {
        await fetch("/api/portals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles, location: merged.location ? [merged.location] : undefined }),
        });
      } catch {
        /* best-effort */
      }
    }
    onSaved?.();
    try {
      markPhaseComplete("onboarding");
      window.dispatchEvent(new CustomEvent("co-cv-saved"));
    } catch {
      /* tour progress best-effort */
    }
    if (afterSave === "stay") return;
    router.push("/");
    router.refresh();
  };

  if (phase === "input" || phase === "error") {
    return (
      <div className="space-y-3">
        <style>{STYLE}</style>
        <div
          className="co-cvdrop p-6"
          data-over={over}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = e.dataTransfer.files?.[0];
            if (f) ingestFile(f);
          }}
        >
          <Md3Textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && paste.trim()) ingestText(paste.trim());
            }}
            placeholder="Paste your CV, or drop a PDF / .md file. Markdown is saved as-is; PDFs are converted locally."
            rows={6}
            className="!border-none !bg-transparent !p-0 !shadow-none"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--md-sys-color-outline-variant)] pt-3">
            <Md3ActionButton icon="upload" onClick={() => fileRef.current?.click()}>
              Upload PDF or .md
            </Md3ActionButton>
            <input ref={fileRef} type="file" accept=".pdf,.md,.markdown,.txt" hidden onChange={(e) => e.target.files?.[0] && ingestFile(e.target.files[0])} />
            <span className="inline-flex items-center gap-1 text-[11px] text-[var(--md-sys-color-outline)]">
              <MaterialSymbol name="lock" size={12} /> Stays on this machine. Nothing is uploaded to us.
            </span>
            <Md3ActionButton variant="filled" icon="arrow_forward" disabled={!paste.trim()} onClick={() => ingestText(paste.trim())} className="ml-auto">
              Read my CV
            </Md3ActionButton>
          </div>
        </div>
        {phase === "error" &&
          (err === "needs-cli" ? (
            <div className="md3-alert md3-alert--warning flex-wrap items-center">
              <MaterialSymbol name="warning" size={14} className="shrink-0" />
              <span>Paste the CV text or drop a .md file — no AI CLI needed. A PDF still works without one; connecting a CLI only polishes the formatting.</span>
              <Link href="/config" className="ml-auto">
                <Md3ActionButton icon="arrow_forward">Connect your AI CLI</Md3ActionButton>
              </Link>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-[13px] text-[var(--md-sys-color-on-tertiary-container)]">
              <MaterialSymbol name="warning" size={14} className="shrink-0" /> {err}
            </p>
          ))}
      </div>
    );
  }

  if (phase === "parsing") {
    return (
      <Md3Card className="backdrop-blur-sm">
        <style>{STYLE}</style>
        <div className="flex items-center gap-2.5">
          <MaterialSymbol name="progress_activity" size={18} className="animate-spin text-[var(--md-sys-color-primary)]" />
          <span className={`${instrumentSerif.className} text-lg text-[var(--md-sys-color-on-surface)]`}>{trace || "Reading your CV…"}</span>
        </div>
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--md-sys-color-tertiary)_30%,transparent)] bg-[var(--md-sys-color-tertiary-container)] px-2.5 py-1 text-[11px] font-semibold text-[var(--md-sys-color-on-tertiary-container)]">
          <span className="size-1.5 rounded-full bg-[var(--md-sys-color-tertiary)]" />{" "}
          {activeCliLabel ? `${activeCliLabel} formatting…` : "Local extract · no tokens"}
        </div>
        {md && (
          <div className="co-cvtrace mt-4 max-h-40 overflow-hidden rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3 text-[11px] text-[var(--md-sys-color-outline)]">
            {md.slice(0, 400)}…
          </div>
        )}
      </Md3Card>
    );
  }

  return (
    <Md3Card className="backdrop-blur-sm">
      <style>{STYLE}</style>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MaterialSymbol name="description" size={18} className="text-[var(--md-sys-color-primary)]" />
        <h3 className={`${instrumentSerif.className} text-lg text-[var(--md-sys-color-on-surface)]`}>Here&apos;s your CV — review and save</h3>
        {readiness && (
          <span
            className={cn(
              "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              readiness.scoreable
                ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
                : "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]",
            )}
          >
            {readiness.scoreable ? <MaterialSymbol name="check" size={12} /> : <MaterialSymbol name="warning" size={12} />}
            {readiness.scoreable ? "Ready to match" : "A bit thin"}
          </span>
        )}
      </div>
      {readiness?.hint && <p className="mb-2 text-[12px] text-[var(--md-sys-color-on-tertiary-container)]">{readiness.hint}</p>}
      {saveErr && (
        <p className="mb-2 flex items-center gap-1.5 text-[12px] text-[var(--md-sys-color-error)]">
          <MaterialSymbol name="warning" size={14} className="shrink-0" /> {saveErr}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <Md3Textarea value={md} onChange={(e) => setMd(e.target.value)} rows={18} className="font-mono text-[12px]" />
        <div className="prose prose-sm dark:prose-invert h-72 max-w-none overflow-y-auto rounded-lg border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-low)] p-3 text-[13px]">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{md}</ReactMarkdown>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Md3ActionButton variant="filled" onClick={save} disabled={phase === "saving"} loading={phase === "saving"} icon={phase === "saving" ? undefined : "check"}>
          Save my CV
        </Md3ActionButton>
        <Md3ActionButton
          variant="text"
          icon="refresh"
          onClick={() => {
            setMd("");
            setSeed(null);
            setPhase("input");
          }}
        >
          Start over
        </Md3ActionButton>
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--md-sys-color-outline)]">
          <MaterialSymbol name="lock" size={12} /> Saved locally to cv.md
        </span>
      </div>
    </Md3Card>
  );
}
