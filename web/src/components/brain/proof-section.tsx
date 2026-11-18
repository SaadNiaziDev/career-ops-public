"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialSymbol } from "@/components/material-symbol";
import { Md3Input, Md3Textarea } from "@/components/ui/md3-input";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { useToast } from "@/components/providers/toast-provider";
import { cn } from "@/lib/cn";
import { PROOF_KINDS, classifyProofUrl, displayHost, normalizeUrl, proofKindMeta, type Proof, type ProofKind } from "@/lib/brain-shared";
import type { GithubInfo } from "@/lib/brain";
import { BrainSection } from "./brain-ui";

async function fetchMeta(url: string): Promise<{ title: string; summary: string } | null> {
  try {
    const res = await fetch("/api/brain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "meta", url }) });
    if (!res.ok) return null;
    return (await res.json()) as { title: string; summary: string };
  } catch {
    return null;
  }
}

function KindIcon({ kind, starred }: { kind: ProofKind; starred?: boolean }) {
  return (
    <span
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-xl",
        starred
          ? "bg-[var(--md-sys-color-tertiary-container)] text-[var(--md-sys-color-on-tertiary-container)]"
          : "bg-[var(--md-sys-color-surface-container-highest)] text-[var(--md-sys-color-on-surface-variant)]",
      )}
    >
      <MaterialSymbol name={proofKindMeta(kind).icon} size={20} />
    </span>
  );
}

function IconButton({ icon, label, onClick, active, filled }: { icon: string; label: string; onClick: () => void; active?: boolean; filled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-full text-[var(--md-sys-color-on-surface-variant)] transition-colors hover:bg-[var(--md-sys-color-surface-container-highest)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)]",
        active && "text-[var(--md-sys-color-tertiary)]",
      )}
    >
      <MaterialSymbol name={icon} size={20} filled={filled} />
    </button>
  );
}

function ProofCard({
  proof,
  onStar,
  onRemove,
  onEdit,
  onRefresh,
}: {
  proof: Proof;
  onStar: () => void;
  onRemove: () => void;
  onEdit: (title: string, summary: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proof.title ?? "");
  const [summary, setSummary] = useState(proof.summary ?? "");
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    setTitle(proof.title ?? "");
    setSummary(proof.summary ?? "");
  }, [proof.title, proof.summary]);
  const meta = proofKindMeta(proof.kind);
  const commit = () => {
    if (title.trim() !== (proof.title ?? "") || summary.trim() !== (proof.summary ?? "")) onEdit(title.trim(), summary.trim());
  };
  return (
    <li
      className={cn(
        "min-w-0 rounded-2xl border p-3 transition-colors sm:p-4",
        proof.starred
          ? "border-[var(--md-sys-color-tertiary)] bg-[color-mix(in_srgb,var(--md-sys-color-tertiary-container)_35%,var(--md-sys-color-surface-container))]"
          : "border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)]",
      )}
    >
      <div className="flex items-start gap-3">
        <KindIcon kind={proof.kind} starred={proof.starred} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="md-label-medium uppercase tracking-wide text-[var(--md-sys-color-on-surface-variant)]">{meta.label}</span>
            {proof.starred ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--md-sys-color-tertiary-container)] px-2 py-0.5 text-xs font-medium text-[var(--md-sys-color-on-tertiary-container)]">
                <MaterialSymbol name="star" size={14} filled /> Leads every email
              </span>
            ) : null}
          </div>
          {editing ? (
            <div className="mt-2 space-y-2">
              <Md3Input aria-label="Title" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} onBlur={commit} placeholder="What is it?" />
              <Md3Textarea aria-label="One-line summary" value={summary} maxLength={300} rows={2} onChange={(e) => setSummary(e.target.value)} onBlur={commit} placeholder="One line on what it shows" />
            </div>
          ) : (
            <>
              <p className="mt-0.5 break-words font-medium text-[var(--md-sys-color-on-surface)]">{proof.title || displayHost(proof.url)}</p>
              {proof.summary ? <p className="mt-0.5 line-clamp-2 break-words text-sm text-[var(--md-sys-color-on-surface-variant)]">{proof.summary}</p> : null}
            </>
          )}
          <a href={proof.url} target="_blank" rel="noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-[var(--md-sys-color-primary)] hover:underline">
            <span className="truncate">{displayHost(proof.url)}</span>
            <MaterialSymbol name="open_in_new" size={14} />
          </a>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-1 border-t border-[var(--md-sys-color-outline-variant)] pt-2">
        <button
          type="button"
          onClick={onStar}
          aria-pressed={!!proof.starred}
          className={cn(
            "mr-auto inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors hover:bg-[var(--md-sys-color-surface-container-highest)]",
            proof.starred ? "text-[var(--md-sys-color-tertiary)]" : "text-[var(--md-sys-color-on-surface-variant)]",
          )}
        >
          <MaterialSymbol name="star" size={18} filled={!!proof.starred} />
          {proof.starred ? "Leading" : "Put first"}
        </button>
        <IconButton icon={editing ? "check" : "edit"} label={editing ? "Done editing" : "Edit title and summary"} onClick={() => { if (editing) commit(); setEditing((v) => !v); }} />
        <IconButton
          icon={refreshing ? "progress_activity" : "refresh"}
          label="Fetch title and summary again"
          onClick={async () => {
            setRefreshing(true);
            await onRefresh();
            setRefreshing(false);
          }}
        />
        <IconButton icon="delete" label="Remove" onClick={onRemove} />
      </div>
    </li>
  );
}

function AddTile({ kind, onAdd, busy }: { kind: ProofKind; onAdd: (kind: ProofKind, url: string) => Promise<boolean>; busy: boolean }) {
  const meta = proofKindMeta(kind);
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-[56px] w-full min-w-0 items-center gap-2.5 rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)] p-3 text-left transition-colors hover:border-[var(--md-sys-color-primary)] hover:bg-[var(--md-sys-color-surface-container)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--md-sys-color-primary)]"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[var(--md-sys-color-surface-container-high)] text-[var(--md-sys-color-on-surface-variant)] sm:size-10 sm:rounded-xl">
          <MaterialSymbol name={meta.icon} size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-[var(--md-sys-color-on-surface)] sm:text-base">{meta.label}</span>
          <span className="hidden truncate text-xs sm:block text-[var(--md-sys-color-on-surface-variant)]">{meta.hint}</span>
        </span>
        <span className="hidden shrink-0 text-[var(--md-sys-color-primary)] sm:inline-flex"><MaterialSymbol name="add" size={20} /></span>
      </button>
    );
  }
  const submit = async () => {
    if (!url.trim()) return setOpen(false);
    if (await onAdd(kind, normalizeUrl(url))) {
      setUrl("");
      setOpen(false);
    }
  };
  return (
    <form
      className="col-span-2 rounded-2xl border border-[var(--md-sys-color-primary)] bg-[var(--md-sys-color-surface-container)] p-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <MaterialSymbol name={meta.icon} size={18} /> {meta.label}
        <span className="font-normal text-[var(--md-sys-color-on-surface-variant)]">· {meta.hint}</span>
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Md3Input
          className="flex-1"
          icon="link"
          autoFocus
          inputMode="url"
          aria-label={`${meta.label} link`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder={meta.placeholder}
        />
        <div className="flex gap-2">
          <Md3ActionButton type="submit" variant="filled" icon="add" loading={busy} disabled={busy || !url.trim()}>Add</Md3ActionButton>
          <Md3ActionButton variant="text" onClick={() => setOpen(false)}>Cancel</Md3ActionButton>
        </div>
      </div>
    </form>
  );
}

function GithubRepos({ handle, proofs, onAddRepo }: { handle: string; proofs: Proof[]; onAddRepo: (url: string, title: string, summary: string) => void }) {
  const [info, setInfo] = useState<GithubInfo | null>(null);
  const [all, setAll] = useState(false);
  useEffect(() => {
    if (!handle) return;
    let live = true;
    setInfo(null);
    fetch(`/api/brain?github=1&handle=${encodeURIComponent(handle)}`)
      .then((r) => r.json())
      .then((d: GithubInfo) => { if (live) setInfo(d); })
      .catch(() => { if (live) setInfo({ handle, publicRepos: 0, repos: [], error: "GitHub didn't answer." }); });
    return () => { live = false; };
  }, [handle]);
  const repos = useMemo(() => {
    const own = (info?.repos ?? []).filter((r) => !r.fork);
    return [...own].sort((a, b) => b.stars - a.stars || b.pushedAt.localeCompare(a.pushedAt));
  }, [info]);
  if (!handle) return null;
  const added = new Set(proofs.map((p) => p.url.replace(/\/$/, "").toLowerCase()));
  const shown = all ? repos : repos.slice(0, 6);
  return (
    <div className="mt-5 rounded-2xl bg-[var(--md-sys-color-surface-container)] p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MaterialSymbol name="code" size={18} />
        <h3 className="md-title-small">From your GitHub</h3>
        <a href={`https://github.com/${handle}`} target="_blank" rel="noreferrer" className="text-sm text-[var(--md-sys-color-primary)] hover:underline">@{info?.handle || handle}</a>
        {info && !info.error ? <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">· {info.publicRepos} public repos</span> : null}
      </div>
      {!info ? (
        <ul className="space-y-2" aria-busy>
          {[0, 1, 2].map((i) => <li key={i} className="h-12 animate-pulse rounded-xl bg-[var(--md-sys-color-surface-container-high)]" />)}
        </ul>
      ) : info.error ? (
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">Couldn't load repos right now ({info.error}). You can still paste repo links above.</p>
      ) : repos.length === 0 ? (
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">No public repos of your own yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-[var(--md-sys-color-outline-variant)]">
            {shown.map((r) => {
              const isAdded = added.has(r.url.replace(/\/$/, "").toLowerCase());
              return (
                <li key={r.url} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <a href={r.url} target="_blank" rel="noreferrer" className="block truncate font-medium hover:underline">{r.name}</a>
                    <p className="truncate text-xs text-[var(--md-sys-color-on-surface-variant)]">
                      {[r.language, r.stars ? `${r.stars}★` : "", r.description].filter(Boolean).join(" · ") || "No description"}
                    </p>
                  </div>
                  {isAdded ? (
                    <span className="inline-flex shrink-0 items-center gap-1 text-xs text-[var(--md-sys-color-on-surface-variant)]"><MaterialSymbol name="check" size={16} /> Added</span>
                  ) : (
                    <Md3ActionButton
                      icon="add"
                      className="shrink-0"
                      aria-label={`Add ${r.name} as proof`}
                      onClick={() => onAddRepo(r.url, r.name, [r.description, r.language].filter(Boolean).join(" · "))}
                    >
                      Page
                    </Md3ActionButton>
                  )}
                </li>
              );
            })}
          </ul>
          {repos.length > 6 ? (
            <Md3ActionButton variant="text" className="mt-1" icon={all ? "expand_less" : "expand_more"} onClick={() => setAll((v) => !v)}>
              {all ? "Show fewer" : `Show all ${repos.length}`}
            </Md3ActionButton>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ProofSection({
  proofs,
  githubHandle,
  percent,
  onSave,
}: {
  proofs: Proof[];
  githubHandle: string;
  percent: number;
  onSave: (proofs: Proof[], message?: string) => Promise<boolean>;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const usedKinds = new Set(proofs.map((p) => p.kind));
  // Slot kinds with nothing yet; "repo" comes from the GitHub list, "other" is always open.
  const emptyKinds = PROOF_KINDS.filter((k) => k.kind !== "repo" && (k.kind === "other" || !usedKinds.has(k.kind)));

  async function add(kind: ProofKind, url: string): Promise<boolean> {
    if (!/^https?:\/\/[^\s.]+\.\S+$/i.test(url)) {
      toast({ message: "That doesn't look like a link.", tone: "error" });
      return false;
    }
    if (proofs.some((p) => p.url === url)) {
      toast({ message: "That link is already here.", tone: "neutral" });
      return true;
    }
    setBusy(true);
    const meta = await fetchMeta(url);
    const finalKind = kind === "other" ? classifyProofUrl(url) : kind;
    const ok = await onSave([...proofs, { kind: finalKind, url, title: meta?.title || "", summary: meta?.summary || "" }], meta ? "Added. It reads well." : "Added. Couldn't read the page, so add a line about it.");
    setBusy(false);
    return ok;
  }

  const replace = (i: number, next: Proof) => proofs.map((p, j) => (j === i ? next : p));

  return (
    <BrainSection
      id="proof"
      icon="workspace_premium"
      title="Proof of work"
      description="Every email links one of these. Fill in the ones you have."
      percent={percent}
    >
      {proofs.length > 0 ? (
        <>
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {proofs.map((p, i) => (
              <ProofCard
                key={p.url}
                proof={p}
                onStar={() => {
                  const lead = !p.starred;
                  void onSave(proofs.map((q, j) => ({ ...q, starred: lead && j === i })), lead ? "Every email will lead with this." : "Outreach will pick the best proof per role.");
                }}
                onRemove={() => void onSave(proofs.filter((_, j) => j !== i), "Removed.")}
                onEdit={(title, summary) => void onSave(replace(i, { ...p, title, summary }), "Saved.")}
                onRefresh={async () => {
                  const meta = await fetchMeta(p.url);
                  if (!meta) {
                    toast({ message: "Couldn't read that page. Edit the summary by hand.", tone: "error" });
                    return;
                  }
                  await onSave(replace(i, { ...p, title: meta.title, summary: meta.summary }), "Refreshed.");
                }}
              />
            ))}
          </ul>
          <p className="mt-3 flex items-start gap-2 text-xs text-[var(--md-sys-color-on-surface-variant)]">
            <MaterialSymbol name="star" size={16} className="mt-px" />
            Star one to lead every email with it, or leave it and outreach picks the best one per role.
          </p>
        </>
      ) : null}

      <div className={cn("grid grid-cols-2 gap-2 lg:grid-cols-3", proofs.length > 0 && "mt-5")}>
        {emptyKinds.map((k) => <AddTile key={k.kind} kind={k.kind} onAdd={add} busy={busy} />)}
      </div>

      <GithubRepos
        handle={githubHandle}
        proofs={proofs}
        onAddRepo={(url, title, summary) => void onSave([...proofs, { kind: "repo", url, title, summary }], `Added ${title}.`)}
      />
    </BrainSection>
  );
}
