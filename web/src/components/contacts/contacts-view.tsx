"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input } from "@/components/ui/md3-input";
import { Badge } from "@/components/ui/badge";

export type ContactRow = {
  date: string;
  trackerNum: string;
  company: string;
  role: string;
  name: string;
  title: string;
  channel: string;
  email: string;
  linkedin: string;
  verified: string;
  source: string;
  notes: string;
};

const PAGE_SIZE = 12;

export function ContactsView({ initial }: { initial: ContactRow[] }) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const [rows] = useState(initial);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.company, r.role, r.name, r.title, r.email, r.notes].some((f) => f.toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const paged = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <PageShell width="default">
      <DossierPageHeader
        title="Contacts & applications memory"
        description="Every application lives in your tracker. Contacts discovered via Find contacts are logged here — linked to the role they belong to."
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Md3Input
          icon="search"
          type="search"
          placeholder="Search company, name, email…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(0);
          }}
          className="max-w-md flex-1"
        />
        <Link href="/pipeline" className="md3-btn-outlined">
          Open pipeline
        </Link>
      </div>

      {filtered.length === 0 ? (
        <Md3Empty description="No contacts yet">
          <p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Open a report → <strong>Find contacts</strong> to discover recruiters and save outreach drafts.
          </p>
        </Md3Empty>
      ) : (
        <>
          <div className="md3-pipeline-list-panel">
            <div className="hidden min-h-12 items-center gap-4 border-b border-[var(--md-sys-color-outline-variant)] px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--md-sys-color-outline)] xl:grid xl:grid-cols-[260px_220px_260px_120px_1fr]">
              <span>Role</span>
              <span>Contact</span>
              <span>Reach</span>
              <span>Date</span>
              <span>Notes</span>
            </div>
            {paged.map((r) => (
              <div
                key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`}
                className="grid min-h-16 items-start gap-4 border-b border-[var(--md-sys-color-outline-variant)] px-6 py-4 last:border-b-0 xl:grid-cols-[260px_220px_260px_120px_1fr]"
              >
                <div className="min-w-0">
                  <Link href={`/pipeline/${r.trackerNum}`} className="font-medium text-[var(--md-sys-color-primary)] hover:underline">
                    {r.company}
                  </Link>
                  <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.role}</div>
                  <Badge tone="muted" className="mt-1">
                    #{r.trackerNum}
                  </Badge>
                </div>
                <div>
                  <div className="font-medium">{r.name || "—"}</div>
                  <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.title || r.channel}</div>
                </div>
                <div className="min-w-0">
                  {r.email ? (
                    <a href={`mailto:${r.email}`} className="block truncate text-sm">
                      {r.email}
                    </a>
                  ) : (
                    <span className="text-xs text-[var(--md-sys-color-outline)]">No email found</span>
                  )}
                  {r.linkedin?.startsWith("http") && (
                    <a
                      href={r.linkedin}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)]"
                    >
                      LinkedIn <MaterialSymbol name="open_in_new" size={14} />
                    </a>
                  )}
                </div>
                <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.date}</div>
                <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.notes || "—"}</div>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <button type="button" className="md3-btn-outlined min-h-10" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button
                  type="button"
                  className="md3-btn-outlined min-h-10"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
