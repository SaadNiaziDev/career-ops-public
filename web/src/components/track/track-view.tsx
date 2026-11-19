"use client";

import Link from "next/link";
import { ApplicationFlowChart } from "./application-flow";
import type { ApplicationFlow } from "@/lib/application-flow";
import { useMemo, useState } from "react";
import type { ApplicationRecordSummary } from "@/lib/application-records";
import { CHANNEL_LABELS } from "@/lib/application-activity-shared";
import { canonStatus } from "@/lib/format";
import { CompanyLogo } from "@/components/ui/company-logo";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import { StatusSelect } from "@/components/track/status-select";

type Tab = "active" | "evaluated" | "closed" | "all";
const TABS: { id: Tab; label: string }[] = [
  { id: "active", label: "In progress" },
  { id: "evaluated", label: "Not applied yet" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
];

function group(status: string): Exclude<Tab, "all"> {
  const s = canonStatus(status);
  if (["APPLIED", "RESPONDED", "INTERVIEW", "OFFER", "HIRED"].includes(s)) return "active";
  if (["REJECTED", "DISCARDED", "SKIP"].includes(s)) return "closed";
  return "evaluated";
}

function day(iso?: string): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
}

const today = () => new Date().toISOString().slice(0, 10);

/** Every application: status, how and when you applied, what you sent, and the next follow-up. */
export function TrackView({ records, flow }: { records: ApplicationRecordSummary[]; flow: ApplicationFlow }) {
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const c: Record<Tab, number> = { active: 0, evaluated: 0, closed: 0, all: records.length };
    for (const r of records) c[group(r.app.status)] += 1;
    return c;
  }, [records]);
  const due = useMemo(() => records.filter((r) => r.nextFollowUp && r.nextFollowUp <= today()).sort((a, b) => a.nextFollowUp!.localeCompare(b.nextFollowUp!)), [records]);
  const stats = useMemo(() => ({
    applied: counts.active + records.filter((r) => group(r.app.status) === "closed" && r.appliedAt).length,
    interviews: records.filter((r) => /^(Interview|Offer|Hired)$/i.test(r.app.status)).length,
    emails: records.reduce((n, r) => n + r.emails + r.followups, 0),
  }), [records, counts]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records
      .filter((r) => tab === "all" || group(r.app.status) === tab)
      .filter((r) => !q || `${r.app.company} ${r.app.role} ${r.app.notes}`.toLowerCase().includes(q))
      .sort((a, b) => (b.lastActivity || b.app.date || "").localeCompare(a.lastActivity || a.app.date || "") || Number(b.app.n) - Number(a.app.n));
  }, [records, tab, query]);

  return (
    <div className="search-page">
      <header className="search-head">
        <div>
          <h1 className="md-headline-medium">Track</h1>
          <p className="search-sub">
            {stats.applied} applied · {stats.interviews} interview{stats.interviews === 1 ? "" : "s"} or offer{stats.interviews === 1 ? "" : "s"} · {stats.emails} email{stats.emails === 1 ? "" : "s"} sent
          </p>
        </div>
        <Link href="/apply" className="md3-action-btn md3-action-btn--outlined"><span className="md3-action-btn__label">Go to Apply</span></Link>
      </header>

      <ApplicationFlowChart flow={flow} />

      {due.length > 0 && (
        <section className="track-due" aria-label="Follow-ups due">
          <h2 className="md-title-small"><MaterialSymbol name="notifications_active" size={18} />Follow-ups due ({due.length})</h2>
          <ul>
            {due.slice(0, 6).map((r) => (
              <li key={r.app.n}>
                <CompanyLogo name={r.app.company} size={24} />
                <span className="track-due__who"><strong>{r.app.company}</strong> · {r.app.role}</span>
                <span className="track-due__why">{r.followUpReason} · due {day(r.nextFollowUp)}</span>
                <Link href={`/apply?n=${r.app.n}#email`} className="search-link">Follow up</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="search-bar">
        <div className="search-tabs" role="tablist">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} className="search-tab" data-active={tab === t.id} onClick={() => setTab(t.id)}>
              {t.label}<span className="search-tab__count">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <div className="search-filters">
          <label className="search-filter">
            <MaterialSymbol name="filter_list" size={18} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter by company, role, notes" aria-label="Filter applications" />
          </label>
        </div>
      </div>

      <div className="search-table" role="table" aria-label="Applications">
        <div className="search-row search-row--head track-row" role="row">
          <span role="columnheader">Role</span>
          <span role="columnheader">Status</span>
          <span role="columnheader">Applied</span>
          <span role="columnheader">Sent</span>
          <span role="columnheader">Next follow-up</span>
          <span role="columnheader" className="search-actions-col">Record</span>
        </div>
        {visible.length === 0 ? (
          <p className="search-empty">{query ? "No applications match that filter." : tab === "active" ? "Nothing in progress. Record a submission from Apply and it shows up here." : "Nothing here yet."}</p>
        ) : (
          visible.map((r) => {
            const overdue = r.nextFollowUp && r.nextFollowUp <= today();
            return (
              <div key={r.app.n} className="search-row track-row" role="row">
                <div className="search-role" role="cell">
                  <CompanyLogo name={r.app.company} size={36} />
                  <div className="min-w-0">
                    <Link href={`/pipeline/${r.app.n}`} className="search-role__title">{r.app.role}</Link>
                    <div className="search-role__company">{r.app.company} · #{r.app.n}{r.app.score && r.app.score !== "—" ? ` · ${r.app.score}` : ""}</div>
                  </div>
                </div>
                <div role="cell"><StatusSelect n={r.app.n} current={r.app.status} score={r.app.score} submissionRecorded={!!r.appliedAt} /></div>
                <span role="cell" className="search-cell">
                  {r.appliedAt ? <>{day(r.appliedAt)}<br /><span className="track-sub">{r.method ? CHANNEL_LABELS[r.method] : ""}</span></> : group(r.app.status) === "evaluated" ? "—" : <span className="track-sub">not recorded</span>}
                </span>
                <span role="cell" className="search-cell">{r.emails + r.followups ? `${r.emails} email${r.emails === 1 ? "" : "s"} · ${r.followups} follow-up${r.followups === 1 ? "" : "s"}` : "—"}</span>
                <span role="cell" className={overdue ? "search-cell track-overdue" : "search-cell"}>{r.nextFollowUp ? day(r.nextFollowUp) : r.followUpReason ? <span className="track-sub">{r.followUpReason}</span> : "—"}</span>
                <div role="cell" className="search-actions">
                  <Link href={`/pipeline/${r.app.n}`} className="md3-action-btn md3-action-btn--outlined search-btn"><span className="md3-action-btn__label">Open</span></Link>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
