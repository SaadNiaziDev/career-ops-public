/** Observed application journeys only; no inferred intermediate stages. */
type Application = { n: string; company: string; role: string; status: string };
type Transition = { n: string; from: string; to: string; at: string };
export type FlowNode = { id: string; label: string; column: number; applications: string[] };
export type FlowLink = { id: string; source: string; target: string; applications: string[] };
export type ApplicationFlow = { nodes: FlowNode[]; links: FlowLink[]; incomplete: { status: string; applications: string[] }[]; excluded: number; included: number; applications: Application[] };
const stages = ["Applied", "Responded", "Interview", "Offer", "Hired"];
const terminal = ["Rejected", "Discarded", "SKIP"];
const normalize = (s: string) => [...stages, ...terminal, "Evaluated"].find(x => x.toLowerCase() === s.replace(/\*/g, "").trim().toLowerCase()) ?? "Unknown";

export function buildApplicationFlow(applications: Application[], transitions: Transition[], submissions: { n: string; at: string }[]): ApplicationFlow {
  const nodes = new Map<string, FlowNode>();
  const links = new Map<string, FlowLink>();
  const incomplete = new Map<string, string[]>();
  let excluded = 0, included = 0;
  function connect(source: FlowNode, target: FlowNode, n: string) {
    for (const node of [source, target]) {
      if (!nodes.has(node.id)) nodes.set(node.id, { ...node, applications: [] });
      const ids = nodes.get(node.id)!.applications;
      if (!ids.includes(n)) ids.push(n);
    }
    const id = `${source.id}->${target.id}`;
    if (!links.has(id)) links.set(id, { id, source: source.id, target: target.id, applications: [] });
    const ids = links.get(id)!.applications;
    if (!ids.includes(n)) ids.push(n);
  }
  const stageNode = (label: string): FlowNode => ({ id: label, label, column: stages.indexOf(label), applications: [] });
  for (const app of applications) {
    const history = transitions.filter(t => t.n === app.n && Number.isFinite(Date.parse(t.at))).sort((a,b) => a.at.localeCompare(b.at));
    const starts = [...history.filter(t => normalize(t.to) === "Applied" || normalize(t.from) === "Applied").map(t => t.at), ...submissions.filter(s => s.n === app.n && Number.isFinite(Date.parse(s.at))).map(s => s.at)].sort();
    if (!starts.length) {
      const status = normalize(app.status);
      if (history.length || stages.slice(1).includes(status) || status === "Applied" || status === "Rejected" || status === "Discarded") {
        const ids = incomplete.get(status) ?? []; ids.push(app.n); incomplete.set(status, ids);
      } else excluded++;
      continue;
    }
    included++;
    let current = "Applied";
    let ended = false;
    let gap = false;
    for (const transition of history.filter(t => t.at >= starts[0])) {
      const from = normalize(transition.from), to = normalize(transition.to);
      if (to === current) continue;
      if (from !== current) { gap = true; break; }
      const backward = stages.indexOf(to) >= 0 && stages.indexOf(to) < stages.indexOf(current);
      if (backward || !stages.includes(to)) {
        const label = backward || ["Evaluated", "Applied"].includes(to) ? "Reopened / moved back" : to === "Discarded" || to === "SKIP" ? "Withdrawn / discarded" : to;
        connect(stageNode(current), { id: `${current}:${label}`, label, column: stages.indexOf(current) + 1, applications: [] }, app.n);
        ended = true; break;
      }
      connect(stageNode(current), stageNode(to), app.n); current = to;
    }
    if (!ended) {
      const label = gap || normalize(app.status) !== current ? "Later history incomplete" : "Currently at this stage";
      connect(stageNode(current), { id: `${current}:${label}`, label, column: stages.indexOf(current) + 1, applications: [] }, app.n);
    }
  }
  return { nodes: [...nodes.values()], links: [...links.values()], incomplete: [...incomplete].map(([status, applications]) => ({status, applications})), included, excluded, applications };
}
