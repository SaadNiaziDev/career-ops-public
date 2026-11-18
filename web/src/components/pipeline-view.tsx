"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ApplicationRecordSummary } from "@/lib/application-records";
import { CHANNEL_LABELS } from "@/lib/application-activity-shared";
import type { OutreachRecord } from "@/lib/outreach-shared";
import { canonStatus } from "@/lib/format";
import { LocalDate } from "@/components/applications/local-date";
import { PageShell } from "@/components/dossier/page-shell";
import { DossierPageHeader } from "@/components/dossier/dossier-page-header";
import { DossierStat } from "@/components/dossier/dossier-stat";
import { CompanyLogo } from "@/components/company-logo";
import { Md3Input } from "@/components/ui/md3-input";
import { StatusSelect } from "@/components/status-select";

const FILTERS = [
  { key: "ACTIVITY", label: "Applications & messages" },
  { key: "APPLIED", label: "Applied" },
  { key: "INTERVIEW", label: "Interviews" },
  { key: "CLOSED", label: "Closed" },
  { key: "ALL", label: "All saved roles" },
];

export function PipelineView({ records, unlinkedMessages = [] }: { records: ApplicationRecordSummary[]; unlinkedMessages?: OutreachRecord[] }) {
  const params = useSearchParams();
  const requested = params.get("tab")?.toUpperCase() || "ACTIVITY";
  const router = useRouter();
  const filter = requested;
  const [query, setQuery] = useState(params.get("q") || "");
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return records.filter((record) => {
      const status = canonStatus(record.app.status);
      const matches = filter === "ALL" || filter === "INBOX" || (filter === "ACTIVITY" ? record.hasActivity
        : filter === "CLOSED" ? ["REJECTED", "DISCARDED", "SKIP"].includes(status)
          : status === filter || (filter === "INTERVIEW" && status === "OFFER"));
      return matches && (!needle || `${record.app.company} ${record.app.role} ${record.app.notes}`.toLowerCase().includes(needle));
    }).sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || "") || Number(b.app.n) - Number(a.app.n));
  }, [records, filter, query]);
  const applied = records.filter((record) => record.appliedAt || /^(Applied|Responded|Interview|Offer|Rejected)$/i.test(record.app.status)).length;

  return <PageShell width="wide">
    <div className="space-y-5">
      <DossierPageHeader title="Track" description="Where you applied, how you applied, what you sent, and what happened next. Open a role for its full record." extra={<Link href="/apply" className="md3-action-btn md3-action-btn--filled">Go to Apply</Link>} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <DossierStat title="Applications" value={applied} />
        <DossierStat title="Emails sent" value={records.reduce((total, record) => total + record.emails, unlinkedMessages.length)} />
        <DossierStat title="Follow-ups" value={records.reduce((total, record) => total + record.followups, 0)} />
        <DossierStat title="Interviews & offers" value={records.filter((record) => /^(Interview|Offer)$/i.test(record.app.status)).length} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Track filters">
          {FILTERS.map((item) => <button key={item.key} type="button" className={`md3-action-btn ${filter === item.key ? "md3-action-btn--filled" : "md3-action-btn--outlined"}`} aria-pressed={filter === item.key} onClick={() => router.replace(`/pipeline?tab=${item.key}`, { scroll: false })}>{item.label}</button>)}
          {!FILTERS.some((item) => item.key === filter) && <button type="button" className="md3-action-btn md3-action-btn--outlined" aria-pressed="true">{filter}</button>}
        </div>
        <Md3Input className="min-w-0 sm:ml-auto sm:w-72" icon="search" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Search application records" placeholder="Company or role" />
      </div>
      <p className="text-xs text-[var(--md-sys-color-on-surface-variant)]">Older tracker entries remain available. Missing dates, methods, or message text are shown as unrecorded.</p>
      <ul className="space-y-3" aria-label="Application records">
        {visible.map((record) => <li key={record.app.n} className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] bg-[var(--md-sys-color-surface-container)] p-4">
          <div className="flex flex-wrap items-start gap-3">
            <CompanyLogo name={record.app.company} size={36} />
            <Link href={`/pipeline/${record.app.n}`} className="min-w-0 flex-1 hover:text-[var(--md-sys-color-primary)]"><h2 className="break-words font-medium">{record.app.company}</h2><p className="break-words text-sm text-[var(--md-sys-color-on-surface-variant)]">{record.app.role}</p></Link>
            <div className="basis-full sm:basis-auto"><StatusSelect n={record.app.n} current={record.app.status} score={record.app.score} submissionRecorded={!!record.appliedAt} /></div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">
            <span>{record.appliedAt ? <>Applied <LocalDate value={record.appliedAt} dateOnly /></> : "Submission details not recorded"}</span>
            <span>{record.method ? CHANNEL_LABELS[record.method] : "Method not recorded"}</span>
            <span>{record.emails} email{record.emails === 1 ? "" : "s"} · {record.followups} follow-up{record.followups === 1 ? "" : "s"}</span>
            <Link href={`/pipeline/${record.app.n}`} className="font-medium text-[var(--md-sys-color-primary)] sm:ml-auto">View record →</Link>
          </div>
        </li>)}
      </ul>
      {["ACTIVITY", "ALL"].includes(filter) && unlinkedMessages.length > 0 && <section className="space-y-3" aria-label="Emails without a linked role"><h2 className="md-title-medium">Emails without a linked tracker role</h2>{unlinkedMessages.filter((item) => !query || `${item.company} ${item.role} ${item.contact.email}`.toLowerCase().includes(query.toLowerCase())).map((item) => <details key={item.id} className="rounded-2xl border border-[var(--md-sys-color-outline-variant)] p-4"><summary className="cursor-pointer font-medium">{item.company} · {item.role || item.subject}</summary><p className="mt-3 text-sm">To {item.contact.email || item.contact.name} · {item.sentAt ? <LocalDate value={item.sentAt} dateOnly /> : "No date recorded"} · {item.sentVia || "Method not recorded"}</p><p className="mt-2 text-sm font-medium">{item.subject}</p><pre className="mt-2 whitespace-pre-wrap break-words font-sans text-sm">{item.body}</pre><Link href="/apply?view=email" className="mt-3 inline-block text-sm text-[var(--md-sys-color-primary)]">View email workspace →</Link></details>)}</section>}
      {!visible.length && <div className="rounded-2xl border border-dashed border-[var(--md-sys-color-outline-variant)] px-6 py-12 text-center"><h2 className="font-medium">No records in this view</h2><p className="mt-2 text-sm text-[var(--md-sys-color-on-surface-variant)]">Search for a role, prepare it in Apply, and record your submission or sent email here.</p><Link href="/explore" className="md3-action-btn md3-action-btn--filled mt-4">Search jobs</Link></div>}
    </div>
  </PageShell>;
}
