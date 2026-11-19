import Link from "next/link";
import { MaterialSymbol } from "@/components/shell/material-symbol";
import type { MachineSummary } from "@/lib/format";

const DIMENSIONS: [keyof NonNullable<MachineSummary["scores"]>, string][] = [
  ["match", "CV match"], ["north_star", "Target fit"], ["comp", "Pay"], ["culture", "Culture"], ["red_flags", "Red flags"],
];

/** The evaluation at a glance, beside the apply steps. */
export function EvaluationSummary({ n, summary, url }: { n: string; summary: MachineSummary | null; url?: string }) {
  const scores = summary?.scores;
  return (
    <aside className="apply-side">
      <section className="apply-card">
        <div className="apply-card__head">
          <h2 className="md-title-medium">Evaluation</h2>
          <Link href={`/pipeline/${n}`} className="search-link apply-card__link">Full report <MaterialSymbol name="arrow_outward" size={14} /></Link>
        </div>
        {!summary ? (
          <p className="apply-muted">No structured summary in this report. Open the full report.</p>
        ) : (
          <>
            <div className="apply-verdict">
              <span className="apply-verdict__score">{typeof summary.score === "number" ? summary.score.toFixed(1) : "—"}<small>/5</small></span>
              <div>
                <div className="apply-verdict__decision">{summary.final_decision ?? "No decision"}</div>
                <div className="apply-muted">{[summary.legitimacy_tier, summary.risk_level ? `${summary.risk_level} risk` : ""].filter(Boolean).join(" · ")}</div>
              </div>
            </div>
            {scores && (
              <dl className="apply-dims">
                {DIMENSIONS.filter(([k]) => typeof scores[k] === "number").map(([k, label]) => (
                  <div key={k} className="apply-dim">
                    <dt>{label}</dt>
                    <dd><span className="apply-dim__bar"><span style={{ width: `${((scores[k] as number) / 5) * 100}%` }} /></span>{(scores[k] as number).toFixed(1)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <List icon="thumb_up" title="Strengths" items={summary.top_strengths} />
            <List icon="build" title="Gaps" items={summary.soft_gaps} />
            <List icon="block" title="Blockers" items={summary.hard_stops} tone="bad" />
            {summary.next_action && <p className="apply-next"><MaterialSymbol name="arrow_forward" size={16} />{summary.next_action}</p>}
            {summary.advertised_comp && <p className="apply-muted">Advertised pay: {summary.advertised_comp}</p>}
          </>
        )}
        {url && (
          <a href={url} target="_blank" rel="noreferrer" className="md3-action-btn md3-action-btn--outlined apply-card__btn">
            <MaterialSymbol name="open_in_new" size={16} /><span className="md3-action-btn__label">Open job posting</span>
          </a>
        )}
      </section>
    </aside>
  );
}

function List({ icon, title, items, tone }: { icon: string; title: string; items?: string[]; tone?: "bad" }) {
  if (!items?.length) return null;
  return (
    <div className="apply-list" data-tone={tone}>
      <h3><MaterialSymbol name={icon} size={16} />{title}</h3>
      <ul>{items.slice(0, 5).map((t) => <li key={t}>{t}</li>)}</ul>
    </div>
  );
}
