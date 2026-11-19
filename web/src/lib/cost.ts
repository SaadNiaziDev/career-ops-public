// Whether an action spends AI tokens. Scans and local actions are free; AI tasks use your subscription.

export type CostClass = "free" | "free-network" | "spend";

export const COST_META: Record<CostClass, { label: string; tip: string }> = {
  "free-network": {
    label: "Free",
    tip: "Scans the public ATS network over HTTP. No AI, no tokens, nothing sent — and it writes nothing until you choose to add a role.",
  },
  free: {
    label: "Free",
    tip: "No tokens. Reads or writes local files only.",
  },
  spend: {
    label: "Uses tokens",
    tip: "Runs a real A–F evaluation on your own AI. This is the only thing that spends tokens — and only when you pick a role.",
  },
};
