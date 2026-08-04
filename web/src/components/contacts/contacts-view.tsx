"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input } from "@/components/ui/md3-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
          <div className="md3-table-wrap">
            <table className="md3-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Reach</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th className="hidden lg:table-cell">Notes</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((r) => (
                  <tr key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`}>
                    <td>
                      <Link href={`/pipeline/${r.trackerNum}`} className="font-medium text-brand-text hover:underline">
                        {r.company}
                      </Link>
                      <div className="text-xs text-muted">{r.role}</div>
                      <Badge tone="muted" className="mt-1">
                        #{r.trackerNum}
                      </Badge>
                    </td>
                    <td>
                      <div className="font-medium">{r.name || "—"}</div>
                      <div className="text-xs text-muted">{r.title || r.channel}</div>
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5">
                        {r.email ? (
                          <a href={`mailto:${r.email}`} className="text-sm">
                            {r.email}
                          </a>
                        ) : (
                          <span className="text-xs text-faint">No email found</span>
                        )}
                        {r.linkedin?.startsWith("http") && (
                          <a
                            href={r.linkedin}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-brand-text"
                          >
                            LinkedIn <MaterialSymbol name="open_in_new" size={14} />
                          </a>
                        )}
                        {r.verified ? (
                          <Badge tone={r.verified === "yes" ? "good" : "muted"} className="mt-1 w-fit">
                            {r.verified}
                          </Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="hidden md:table-cell">{r.date}</td>
                    <td className="hidden lg:table-cell">
                      <span className="text-xs text-muted">{r.notes}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
                {safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={safePage === 0} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={safePage >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
