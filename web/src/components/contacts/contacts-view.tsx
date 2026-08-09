"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input } from "@/components/ui/md3-input";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { Badge } from "@/components/ui/badge";
import type { ContactRow, ContactType, OutreachStatus } from "@/lib/contacts";

const OUTREACH_OPTIONS: { value: OutreachStatus; label: string }[] = [
  { value: "not-contacted", label: "Not contacted" },
  { value: "messaged", label: "Messaged" },
  { value: "replied", label: "Replied" },
  { value: "ghosted", label: "Ghosted" },
];

const CONTACT_TYPES: ContactType[] = ["recruiter", "hiring-manager", "peer", "interviewer"];

function ContactRowView({
  r,
  onStatusChange,
}: {
  r: ContactRow;
  onStatusChange: (row: ContactRow, status: OutreachStatus) => void;
}) {
  return (
    <div className="grid min-h-16 items-start gap-4 border-b border-[var(--md-sys-color-outline-variant)] px-6 py-4 last:border-b-0 xl:grid-cols-[260px_220px_260px_140px_120px_1fr]">
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
        {r.contactType && (
          <span className="mt-1 inline-block rounded-full bg-[var(--md-sys-color-surface-container-highest)] px-2 py-0.5 text-[10px] uppercase tracking-wide">
            {r.contactType.replace("-", " ")}
          </span>
        )}
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
          <a href={r.linkedin} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)]">
            LinkedIn <MaterialSymbol name="open_in_new" size={14} />
          </a>
        )}
      </div>
      <div>
        <select
          className="h-9 w-full rounded-[var(--md-sys-shape-corner-small)] border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container-high)] px-2 text-xs"
          value={r.outreachStatus || "not-contacted"}
          onChange={(e) => onStatusChange(r, e.target.value as OutreachStatus)}
        >
          {OUTREACH_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {r.lastTouch && <p className="mt-1 text-[10px] text-[var(--md-sys-color-outline)]">Last: {r.lastTouch}</p>}
      </div>
      <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.date}</div>
      <div className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.notes || "—"}</div>
    </div>
  );
}

export function ContactsView({ initial }: { initial: ContactRow[] }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(initial);
  const [grouped, setGrouped] = useState(true);
  const [channels, setChannels] = useState<Set<string>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState<boolean | null>(null);
  const [types, setTypes] = useState<Set<ContactType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<OutreachStatus>>(new Set());

  const availChannels = useMemo(
    () => Array.from(new Set(rows.map((r) => r.channel).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle && ![r.company, r.role, r.name, r.title, r.email, r.notes].some((f) => f.toLowerCase().includes(needle))) {
        return false;
      }
      if (channels.size && !channels.has(r.channel)) return false;
      if (verifiedOnly === true && r.verified !== "verified") return false;
      if (verifiedOnly === false && r.verified === "verified") return false;
      if (types.size && !types.has(r.contactType)) return false;
      if (statusFilter.size && !statusFilter.has((r.outreachStatus || "not-contacted") as OutreachStatus)) return false;
      return true;
    });
  }, [rows, q, channels, verifiedOnly, types, statusFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const r of filtered) {
      const key = r.company || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  async function patchStatus(row: ContactRow, outreachStatus: OutreachStatus) {
    const res = await fetch("/api/contacts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: row.email,
        linkedin: row.linkedin,
        trackerNum: row.trackerNum,
        name: row.name,
        outreach_status: outreachStatus,
        last_touch: new Date().toISOString().slice(0, 10),
      }),
    });
    if (!res.ok) return;
    const lastTouch = new Date().toISOString().slice(0, 10);
    setRows((prev) =>
      prev.map((r) => {
        const same =
          (row.email && r.email === row.email) ||
          (row.linkedin && r.linkedin === row.linkedin) ||
          (r.trackerNum === row.trackerNum && r.name === row.name && r.date === row.date);
        return same ? { ...r, outreachStatus, lastTouch } : r;
      }),
    );
  }

  return (
    <PageShell width="default">
      <DossierPageHeader title="Contacts & applications memory" description="Grouped by company — filter by channel, type, and outreach status." />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Md3Input icon="search" type="search" placeholder="Search company, name, email…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md flex-1" />
        <button type="button" className="md3-btn-outlined min-h-10" onClick={() => setGrouped((g) => !g)}>
          {grouped ? "Flat list" : "Group by company"}
        </button>
        <Link href="/pipeline" className="md3-btn-outlined">
          Open pipeline
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {availChannels.map((ch) => (
          <Md3Chip key={ch} active={channels.has(ch)} onClick={() => setChannels((prev) => { const n = new Set(prev); if (n.has(ch)) n.delete(ch); else n.add(ch); return n; })}>
            {ch}
          </Md3Chip>
        ))}
        {CONTACT_TYPES.map((t) => (
          <Md3Chip key={t} active={types.has(t)} onClick={() => setTypes((prev) => { const n = new Set(prev); if (n.has(t)) n.delete(t); else n.add(t); return n; })}>
            {t.replace("-", " ")}
          </Md3Chip>
        ))}
        <Md3Chip active={verifiedOnly === true} onClick={() => setVerifiedOnly((v) => (v === true ? null : true))}>
          Verified
        </Md3Chip>
        {OUTREACH_OPTIONS.map((o) => (
          <Md3Chip key={o.value} active={statusFilter.has(o.value)} onClick={() => setStatusFilter((prev) => { const n = new Set(prev); if (n.has(o.value)) n.delete(o.value); else n.add(o.value); return n; })}>
            {o.label}
          </Md3Chip>
        ))}
        <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">
          {filtered.length}/{rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <Md3Empty description="No contacts match">
          <p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Open a report → <strong>Find contacts</strong> to discover recruiters and save outreach drafts.
          </p>
        </Md3Empty>
      ) : grouped ? (
        <div className="space-y-3">
          {groups.map(([company, items]) => (
            <Md3Collapse
              key={company}
              title={
                <span>
                  <strong>{company}</strong> <span className="text-xs text-[var(--md-sys-color-on-surface-variant)]">· {items.length}</span>
                </span>
              }
            >
              <div className="md3-pipeline-list-panel -mx-2">
                {items.map((r) => (
                  <ContactRowView key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`} r={r} onStatusChange={patchStatus} />
                ))}
              </div>
            </Md3Collapse>
          ))}
        </div>
      ) : (
        <div className="md3-pipeline-list-panel">
          {filtered.map((r) => (
            <ContactRowView key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`} r={r} onStatusChange={patchStatus} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
