"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { ApplicationFlow, FlowNode } from "@/lib/application-flow";

export function ApplicationFlowChart({ flow }: { flow: ApplicationFlow }) {
  const [selection, setSelection] = useState<{ label: string; ids: string[] } | null>(null);
  const layout = useMemo(() => {
    const columns = Array.from({ length: Math.max(1, ...flow.nodes.map(n => n.column)) + 1 }, (_, i) => flow.nodes.filter(n => n.column === i));
    const scale = Math.min(28, 350 / Math.max(1, flow.included));
    const positions = new Map<string, { x: number; y: number; height: number; node: FlowNode }>();
    let height = 140;
    columns.forEach((nodes, column) => {
      let y = 60;
      nodes.forEach(node => { const h = node.applications.length * scale; positions.set(node.id, { x: 30 + column * 230, y, height: h, node }); y += h + 70; });
      height = Math.max(height, y);
    });
    const outgoing = new Map<string, number>(), incoming = new Map<string, number>();
    const paths = flow.links.map(link => {
      const a = positions.get(link.source)!, b = positions.get(link.target)!;
      const width = link.applications.length * scale;
      const y1 = a.y + (outgoing.get(link.source) ?? 0) + width / 2;
      const y2 = b.y + (incoming.get(link.target) ?? 0) + width / 2;
      outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + width);
      incoming.set(link.target, (incoming.get(link.target) ?? 0) + width);
      return { link, width, d: `M ${a.x + 14} ${y1} C ${a.x + 120} ${y1}, ${b.x - 100} ${y2}, ${b.x} ${y2}`, label: `${a.node.label} → ${b.node.label}: ${link.applications.length} applications` };
    });
    return { positions, paths, height, width: Math.max(600, columns.length * 230) };
  }, [flow]);
  const selected = flow.applications.filter(app => selection?.ids.includes(app.n));
  const incompleteCount = flow.incomplete.reduce((sum, group) => sum + group.applications.length, 0);
  return <details className="application-flow">
    <summary className="md-title-medium">Application flow · {flow.included} recorded journeys</summary>
    <p className="search-sub">All recorded history, independent of the filters below. Connections count applications, not messages. {flow.excluded} never-submitted roles excluded.</p>
    {flow.links.length ? <>
      <div className="application-flow-scroll" tabIndex={0} role="region" aria-label="Application flow chart; scroll horizontally on small screens">
        <svg width={layout.width} height={layout.height} role="group" aria-label="Application outcomes Sankey chart">
          {layout.paths.map(({link, width, d, label}) => <path key={link.id} d={d} stroke="var(--md-sys-color-primary)" strokeOpacity=".3" strokeWidth={width} fill="none" tabIndex={0} role="button" aria-label={label} onClick={() => setSelection({label, ids:link.applications})} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelection({label,ids:link.applications}); } }}><title>{label}</title></path>)}
          {[...layout.positions.values()].map(({x,y,height,node}) => <g key={node.id} tabIndex={0} role="button" aria-label={`${node.label}: ${node.applications.length} applications`} onClick={() => setSelection({label:node.label,ids:node.applications})} onKeyDown={event => { if (["Enter", " "].includes(event.key)) { event.preventDefault(); setSelection({label:node.label,ids:node.applications}); } }}>
            <title>{node.label}: {node.applications.length} applications</title><rect x={x} y={y} width={14} height={height} rx={3} fill="var(--md-sys-color-primary)" /><text x={x} y={y-12} fill="var(--md-sys-color-on-surface)" fontSize={12}>{node.label} ({node.applications.length})</text>
          </g>)}
        </svg>
      </div>
      <details><summary>Connection counts (table)</summary><table className="application-flow-table"><thead><tr><th>From</th><th>To</th><th>Applications</th></tr></thead><tbody>{flow.links.map(link => <tr key={link.id}><td>{flow.nodes.find(n => n.id===link.source)?.label}</td><td>{flow.nodes.find(n => n.id===link.target)?.label}</td><td><button type="button" className="search-link" onClick={() => setSelection({label:"Selected connection",ids:link.applications})}>{link.applications.length}</button></td></tr>)}</tbody></table></details>
    </> : <p>No reconstructable application journeys yet. Record submissions and status changes to populate this chart.</p>}
    <details><summary>History incomplete · {incompleteCount}</summary><p>These roles have no recorded submission start, so their intermediate stages are not assumed.</p>{flow.incomplete.map(group => <button key={group.status} className="md3-action-btn md3-action-btn--outlined" type="button" onClick={() => setSelection({label:`History incomplete: ${group.status}`,ids:group.applications})}>{group.status}: {group.applications.length}</button>)}</details>
    {selection && <section aria-label="Selected applications" aria-live="polite"><div className="search-actions"><h3 className="md-title-small">{selection.label}</h3><button type="button" className="search-link" onClick={() => setSelection(null)}>Clear selection</button></div><ul>{selected.map(app => <li key={app.n}><Link className="search-link" href={`/pipeline/${app.n}`}>{app.company} · {app.role}</Link></li>)}</ul></section>}
  </details>;
}
