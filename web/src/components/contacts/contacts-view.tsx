"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MaterialSymbol } from "@/components/material-symbol";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { Md3Empty } from "@/components/ui/md3-empty";
import { Md3Input } from "@/components/ui/md3-input";
import { Md3Chip } from "@/components/ui/md3-chip";
import { Md3Collapse } from "@/components/ui/md3-collapse";
import { Md3Select } from "@/components/ui/md3-select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/providers/toast-provider";
import type { ContactRow, ContactType, OutreachStatus } from "@/lib/contacts";
import { readSortPreference, sortContacts, writeSortPreference, type ContactOrder } from "@/lib/list-sort-policy";
import { FollowUpCard, type FollowUp } from "@/components/home/follow-up-card";
import type { Application } from "@/lib/career-ops";

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
  applicationStatus,
  nextDue,
}: {
  r: ContactRow;
  onStatusChange: (row: ContactRow, status: OutreachStatus) => void;
  applicationStatus?: string;
  nextDue?: string;
}) {
  return (
    <div className="grid min-h-16 grid-cols-1 items-start gap-x-5 gap-y-3 border-b border-[var(--md-sys-color-outline-variant)] px-5 py-4 last:border-b-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(9.5rem,auto)_6.5rem_minmax(0,1.35fr)]">
      <div className="min-w-0">
        <Link href={`/pipeline/${r.trackerNum}`} className="font-medium text-[var(--md-sys-color-primary)] hover:underline">
          {r.company}
        </Link>
        <div className="truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.role}</div>
        <Badge tone="muted" className="mt-1">
          #{r.trackerNum}
        </Badge>
        {applicationStatus && <p className="mt-1 text-xs text-[var(--md-sys-color-on-surface-variant)]">Application: {applicationStatus}</p>}
        {nextDue && <p className="mt-1 text-xs text-[var(--md-sys-color-error)]">Next follow-up: {nextDue}</p>}
      </div>
      <div className="min-w-0">
        <div className="truncate font-medium">{r.name || "—"}</div>
        <div className="truncate text-sm text-[var(--md-sys-color-on-surface-variant)]">{r.title || r.channel}</div>
        {r.contactType ? (
          <span className="mt-1 inline-block rounded-full bg-[var(--md-sys-color-surface-container-highest)] px-2 py-0.5 text-[10px] uppercase tracking-wide">
            {r.contactType.replace("-", " ")}
          </span>
        ) : null}
        <div className="mt-2 flex flex-col items-start gap-1">
          {r.email ? (
            <a href={`mailto:${r.email}`} className="max-w-full truncate text-sm">
              {r.email}
            </a>
          ) : (
            <span className="text-xs text-[var(--md-sys-color-outline)]">No email found</span>
          )}
          {r.linkedin?.startsWith("http") ? (
            <a
              href={r.linkedin}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--md-sys-color-primary)]"
            >
              LinkedIn <MaterialSymbol name="open_in_new" size={14} />
            </a>
          ) : null}
        </div>
      </div>
      <div className="min-w-[9.5rem]">
        {(r.outreachStatus || "not-contacted") === "messaged" ? <Badge tone="good" className="inline-flex">Message sent</Badge> : <Md3Select
          className="w-full min-w-[9.5rem]"
          aria-label={`Outreach status for ${r.name || r.company}`}
          value={r.outreachStatus || "not-contacted"}
          onChange={(v) => onStatusChange(r, v as OutreachStatus)}
          options={OUTREACH_OPTIONS.filter((option) => option.value !== "messaged")}
        />}
        {r.lastTouch ? <p className="mt-1 text-[10px] text-[var(--md-sys-color-outline)]">Last: {r.lastTouch}</p> : null}
        {r.verified !== "verified" && <p className="mt-1 text-xs text-[var(--md-sys-color-error)]">{/bounce|invalid/i.test(`${r.verified} ${r.notes}`) ? "Bounced or invalid contact — verify before use." : "Contact not verified."}</p>}
      </div>
      <div className="whitespace-nowrap text-sm tabular-nums text-[var(--md-sys-color-on-surface-variant)]">{r.date}</div>
      <div className="min-w-0 text-sm leading-snug text-[var(--md-sys-color-on-surface-variant)] [overflow-wrap:anywhere]">
        {r.notes || "—"}
      </div>
    </div>
  );
}

export function ContactsView({ initial, applications = [] }: { initial: ContactRow[]; applications?: Application[] }) {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState(initial);
  const [grouped, setGrouped] = useState(false);
  const [order, setOrder] = useState<ContactOrder>("newest");
  useEffect(() => setOrder(readSortPreference<ContactOrder>("career-ops:contacts-order", ["newest", "oldest", "company"], "newest")), []);
  const changeOrder = (value: string) => {
    const next = value as ContactOrder;
    setOrder(next);
    writeSortPreference("career-ops:contacts-order", next);
  };
  const [channels, setChannels] = useState<Set<string>>(new Set());
  const [verifiedOnly, setVerifiedOnly] = useState<boolean | null>(null);
  const [types, setTypes] = useState<Set<ContactType>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<OutreachStatus>>(new Set());
  const [mode, setMode] = useState<"due" | "contacts">("due");
  const [dueRows, setDueRows] = useState<FollowUp[]>([]);
  const [cadenceRows, setCadenceRows] = useState<FollowUp[]>([]);
  const [snoozedRows, setSnoozedRows] = useState<{ num: number; snoozedUntil: string }[]>([]);
  const [followupsUnavailable, setFollowupsUnavailable] = useState(false);
  const applicationsByNum = useMemo(() => new Map(applications.map((application) => [application.n, application])), [applications]);
  const dueByNum = useMemo(() => new Map(cadenceRows.map((entry) => [String(entry.num), entry])), [cadenceRows]);
  const snoozedByNum = useMemo(() => new Map(snoozedRows.map((entry) => [String(entry.num), entry])), [snoozedRows]);

  async function refreshDue() {
    try {
      const response = await fetch("/api/followups?all=1");
      const data = await response.json() as { available?: boolean; entries?: FollowUp[]; snoozed?: { num: number; snoozedUntil: string }[] };
      setFollowupsUnavailable(!response.ok || data.available === false);
      setCadenceRows(data.entries ?? []);
      setSnoozedRows(data.snoozed ?? []);
      setDueRows((data.entries ?? []).filter((entry) => /overdue|urgent|due/i.test(entry.urgency ?? "")));
    } catch {
      setFollowupsUnavailable(true);
      setDueRows([]);
    }
  }
  useEffect(() => { void refreshDue(); }, []);

  const availChannels = useMemo(
    () => Array.from(new Set(rows.map((r) => r.channel).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return sortContacts(rows.filter((r) => {
      if (needle && ![r.company, r.role, r.name, r.title, r.email, r.notes].some((f) => f.toLowerCase().includes(needle))) {
        return false;
      }
      if (channels.size && !channels.has(r.channel)) return false;
      if (verifiedOnly === true && r.verified !== "verified") return false;
      if (verifiedOnly === false && r.verified === "verified") return false;
      if (types.size && !types.has(r.contactType)) return false;
      if (statusFilter.size && !statusFilter.has((r.outreachStatus || "not-contacted") as OutreachStatus)) return false;
      return true;
    }), order);
  }, [rows, q, channels, verifiedOnly, types, statusFilter, order]);

  const groups = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const r of filtered) {
      const key = r.company || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(r);
    }
    return [...map.entries()];
  }, [filtered]);

  // S09 · state `write failed`: the row moves optimistically, then reverts to
  // the value that is actually on disk and offers Retry — never a silent drop.
  async function patchStatus(row: ContactRow, outreachStatus: OutreachStatus) {
    const isSame = (r: ContactRow) =>
      (row.email && r.email === row.email) ||
      (row.linkedin && r.linkedin === row.linkedin) ||
      (r.trackerNum === row.trackerNum && r.name === row.name && r.date === row.date);

    const previous = row.outreachStatus;
    setRows((prev) => prev.map((r) => (isSame(r) ? { ...r, outreachStatus } : r)));

    try {
      const res = await fetch("/api/contacts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: row.email,
          linkedin: row.linkedin,
          trackerNum: row.trackerNum,
          name: row.name,
          outreach_status: outreachStatus,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
    } catch {
      setRows((prev) =>
        prev.map((r) => (isSame(r) ? { ...r, outreachStatus: previous } : r)),
      );
      toast({
        tone: "error",
        message: `Could not write ${row.name || row.company} to contacts.tsv`,
        action: { label: "Retry", onClick: () => void patchStatus(row, outreachStatus) },
      });
    }
  }

  return (
    <PageShell width="wide">
      <div data-co-tour="outreach-intro">
        <DossierPageHeader title="Outreach" description="Complete due follow-ups first; open the contact directory when you need someone specific." />
      </div>

      <div className="mb-4 flex gap-2" role="tablist" aria-label="Outreach views">
        <button type="button" role="tab" aria-selected={mode === "due"} className="md3-btn-outlined" onClick={() => setMode("due")}>Due now ({dueRows.length})</button>
        <button type="button" role="tab" aria-selected={mode === "contacts"} className="md3-btn-outlined" onClick={() => setMode("contacts")}>Contact directory</button>
      </div>

      {mode === "due" && <section aria-label="Due follow-ups" className="mb-6 space-y-3">
        {followupsUnavailable ? <p role="status" className="md3-alert md3-alert--warning">Follow-up cadence is unavailable. Retry, or open the contact directory to continue.</p> : dueRows.length ? dueRows.map((followup) => <FollowUpCard key={`${followup.num}-${followup.company}`} followup={followup} onLogged={(warning) => { void refreshDue(); if (warning) toast({ tone: "error", message: warning }); }} onSnoozed={() => void refreshDue()} />) : <Md3Empty description="No follow-ups due now"><p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">The cadence tracker has no overdue or urgent follow-ups.</p></Md3Empty>}
      </section>}

      {mode === "contacts" && <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Md3Input icon="search" type="search" placeholder="Search company, name, email…" value={q} onChange={(e) => setQ(e.target.value)} className="w-[420px] max-w-full" />
        <button type="button" className="md3-btn-outlined min-h-10" onClick={() => setGrouped((g) => !g)}>
          {grouped ? "Flat list" : "Group by company"}
        </button>
        <Md3Select
          value={order}
          onChange={changeOrder}
          aria-label="Sort contacts"
          options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }, { value: "company", label: "Company A–Z" }]}
        />
        <Link href="/pipeline" className="md3-btn-outlined">
          Open pipeline
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2" data-co-tour="outreach-filters">
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
        <div data-co-tour="outreach-list">
        <Md3Empty description="No contacts match">
          <p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            Open a report → <strong>Find contacts</strong> to discover recruiters and save outreach drafts.
          </p>
        </Md3Empty>
        </div>
      ) : grouped ? (
        <div className="space-y-3" data-co-tour="outreach-list">
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
                  <ContactRowView key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`} r={r} onStatusChange={patchStatus} applicationStatus={applicationsByNum.get(r.trackerNum)?.status} nextDue={dueByNum.get(r.trackerNum)?.nextFollowupDate || snoozedByNum.get(r.trackerNum)?.snoozedUntil} />
                ))}
              </div>
            </Md3Collapse>
          ))}
        </div>
      ) : (
        <div className="md3-pipeline-list-panel" data-co-tour="outreach-list">
          {filtered.map((r) => (
            <ContactRowView key={`${r.trackerNum}-${r.name}-${r.email}-${r.date}`} r={r} onStatusChange={patchStatus} applicationStatus={applicationsByNum.get(r.trackerNum)?.status} nextDue={dueByNum.get(r.trackerNum)?.nextFollowupDate || snoozedByNum.get(r.trackerNum)?.snoozedUntil} />
          ))}
        </div>
      )}
      </>}
    </PageShell>
  );
}
