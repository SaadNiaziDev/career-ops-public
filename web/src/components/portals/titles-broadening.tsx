"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { Badge } from "@/components/ui/badge";
import { Md3ActionButton } from "@/components/ui/md3-action-button";
import { Md3Card } from "@/components/ui/md3-card";
import { Md3Empty } from "@/components/ui/md3-empty";
import { useJobs } from "@/components/jobs/job-store";
import type { TitleSuggestion } from "@/lib/titles";
import { cn } from "@/lib/cn";

const AXIS_TONE: Record<string, "good" | "warn" | "muted"> = {
  Lateral: "good",
  Stretch: "warn",
  Pivot: "muted",
};

const PAGE_SIZE = 8;

type Props = {
  compact?: boolean;
};

type Row = TitleSuggestion & { key: string; already: boolean };

export function TitlesBroadening({ compact = false }: Props) {
  const { jobs, startJob } = useJobs();
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "error"; text: string } | null>(null);

  const running = useMemo(
    () => jobs.some((j) => j.kind === "titles" && j.status === "running"),
    [jobs],
  );

  const flash = (tone: "info" | "success" | "error", text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/titles")
      .then((r) => r.json())
      .then((d) => {
        setSuggestions(Array.isArray(d.suggestions?.suggestions) ? d.suggestions.suggestions : []);
        setGeneratedAt(d.suggestions?.generatedAt ?? null);
        setKeywords(Array.isArray(d.keywords) ? d.keywords : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
    const onDone = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (detail?.kind === "titles") load();
    };
    window.addEventListener("co-job-done", onDone);
    return () => window.removeEventListener("co-job-done", onDone);
  }, [load]);

  const keywordLower = useMemo(() => new Set(keywords.map((k) => k.toLowerCase())), [keywords]);

  const rows = useMemo(
    (): Row[] =>
      suggestions.map((s, i) => ({
        key: `${s.keyword}-${i}`,
        ...s,
        already: keywordLower.has((s.keyword || s.title).toLowerCase()),
      })),
    [suggestions, keywordLower],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = rows.length > PAGE_SIZE ? rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE) : rows;

  const runTitles = () => {
    const id = startJob({
      title: "Broaden search titles",
      subtitle: "CV-driven adjacent roles",
      kind: "titles",
      input: "broaden",
      page: "/portals",
    });
    if (id) flash("info", "Analyzing your CV for adjacent titles — check Workers for progress.");
  };

  const toggle = (keyword: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(keyword);
      else next.delete(keyword);
      return next;
    });
  };

  const applySelected = async () => {
    const kws = [...selected];
    if (kws.length === 0) return;
    setApplying(true);
    try {
      const res = await fetch("/api/portals/append-keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: kws }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      flash("success", `Added ${data.added?.length ?? kws.length} keyword(s) to portals.yml`);
      setSelected(new Set());
      load();
    } catch (e) {
      flash("error", e instanceof Error ? e.message : "Could not update portals.yml");
    } finally {
      setApplying(false);
    }
  };

  if (compact) {
    return (
      <Md3Card
        className="!p-0"
        title={<span className="md-title-medium">Broaden your search</span>}
        extra={
          <Link href="/portals#titles" className="text-xs text-[var(--md-sys-color-primary)]">
            Manage →
          </Link>
        }
      >
        <p className="mb-3 text-sm text-[var(--md-sys-color-on-surface-variant)]">
          Your scanner only finds roles matching <code>title_filter.positive</code>. Discover adjacent titles from your CV.
        </p>
        <div className="md3-actions-row">
          <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
            {keywords.length} active keywords
            {generatedAt ? ` · last run ${generatedAt}` : ""}
          </span>
          <Md3ActionButton icon="refresh" loading={running} onClick={runTitles} disabled={running}>
            Suggest titles
          </Md3ActionButton>
        </div>
      </Md3Card>
    );
  }

  return (
    <div id="titles">
    <Md3Card
      className="mt-5"
      title={<span className="md-title-medium">Broaden search titles</span>}
      extra={
        <Md3ActionButton variant="filled" icon="add" loading={running} onClick={runTitles} disabled={running}>
          Analyze CV for adjacent titles
        </Md3ActionButton>
      }
    >
      <p className="text-[var(--md-sys-color-on-surface-variant)]">
        The free scanner matches <code>portals.yml</code> keywords only. This reads your CV and suggests adjacent market titles —
        you pick which keywords to add. Nothing is written until you confirm.
      </p>

      {notice && (
        <p
          className={cn(
            "md3-alert mt-4",
            notice.tone === "info" && "md3-alert--info",
            notice.tone === "success" && "md3-alert--success",
            notice.tone === "error" && "md3-alert--error",
          )}
        >
          {notice.text}
        </p>
      )}

      {keywords.length > 0 && (
        <div className="mb-4 mt-4 flex flex-wrap gap-1">
          {keywords.slice(0, 12).map((k) => (
            <Badge key={k} tone="muted">
              {k}
            </Badge>
          ))}
          {keywords.length > 12 && <Badge tone="muted">+{keywords.length - 12} more</Badge>}
        </div>
      )}

      {generatedAt && (
        <p className="mb-3 text-xs text-[var(--md-sys-color-on-surface-variant)]">Last generated {generatedAt}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <MaterialSymbol name="progress_activity" size={28} className="animate-spin text-[var(--md-sys-color-primary)]" />
        </div>
      ) : rows.length === 0 ? (
        <Md3Empty icon="work" description="Run the analyzer to get CV-driven title suggestions" />
      ) : (
        <>
          <div className="md3-table-wrap">
            <table className="md3-table">
              <thead>
                <tr>
                  <th className="w-11" />
                  <th>Title</th>
                  <th className="w-24">Axis</th>
                  <th className="hidden md:table-cell">Evidence</th>
                  <th className="hidden lg:table-cell">Gap</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((row) => (
                  <tr key={row.key}>
                    <td>
                      {row.already ? (
                        <Badge tone="muted">active</Badge>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selected.has(row.keyword)}
                          onChange={(e) => toggle(row.keyword, e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${row.title}`}
                          className="size-4 accent-[var(--md-sys-color-primary)]"
                        />
                      )}
                    </td>
                    <td>
                      <div className="font-medium">{row.title}</div>
                      <div className="text-xs text-[var(--md-sys-color-on-surface-variant)]">keyword: {row.keyword}</div>
                    </td>
                    <td>
                      <Badge tone={AXIS_TONE[row.axis] ?? "muted"}>{row.axis}</Badge>
                    </td>
                    <td className="hidden max-w-xs truncate md:table-cell">{row.evidence}</td>
                    <td className="hidden max-w-xs truncate lg:table-cell">{row.gap}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > PAGE_SIZE && (
            <div className="md3-actions-row mt-3 justify-end">
              <Md3ActionButton variant="text" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Md3ActionButton>
              <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
                Page {safePage + 1} of {pageCount}
              </span>
              <Md3ActionButton variant="text" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => p + 1)}>
                Next
              </Md3ActionButton>
            </div>
          )}
        </>
      )}

      {selected.size > 0 && (
        <div className="md3-alert md3-alert--info mt-4 flex-col items-stretch">
          <span>
            Add <strong>{selected.size}</strong> keyword{selected.size === 1 ? "" : "s"} to portals.yml?
          </span>
          <div className="md3-actions-row mt-2">
            <Md3ActionButton variant="filled" loading={applying} onClick={applySelected}>
              Confirm &amp; append
            </Md3ActionButton>
            <Link href="/explore?run=1">
              <Md3ActionButton icon="explore">Re-scan after adding</Md3ActionButton>
            </Link>
          </div>
        </div>
      )}
    </Md3Card>
    </div>
  );
}
