// Fit-score ranking weights — pure half (no fs), safe in client components.
// The filesystem half lives in lib/core/weights.ts.
//
// On disk (portals.yml → `ranking.weights`) they are 0–1 fractions summing to
// ~1.0, the format scan.mjs documents. In the UI they are whole percents
// summing to exactly 100, because a slider that reads 0.35 is a worse control
// than one that reads 35.

export const WEIGHT_KEYS = ["cv_overlap", "title_match", "comp_fit", "freshness", "trust"] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;

/** Percent defaults — mirror templates/portals.example.yml. */
export const DEFAULT_WEIGHTS: Weights = {
  cv_overlap: 35,
  title_match: 25,
  comp_fit: 15,
  freshness: 15,
  trust: 10,
};

export const WEIGHT_LABEL: Record<WeightKey, string> = {
  cv_overlap: "CV overlap",
  title_match: "Title match",
  comp_fit: "Comp fit",
  freshness: "Freshness",
  trust: "Trust",
};

export const WEIGHT_HINT: Record<WeightKey, string> = {
  cv_overlap: "Skills in the posting that also appear in cv.md",
  title_match: "Distance from your title_filter.positive list",
  comp_fit: "Advertised range against your target band",
  freshness: "How recently the posting went up",
  trust: "Legitimacy signals from the scanner's trust validator",
};

/**
 * Round a percent map so it sums to exactly 100 — the largest remainder takes
 * the drift, which keeps the biggest weight looking stable as others move.
 */
export function normalizeWeights(raw: Partial<Record<WeightKey, number>>): Weights {
  const clean = WEIGHT_KEYS.map((k) => {
    const n = Number(raw[k]);
    return Number.isFinite(n) && n > 0 ? n : 0;
  });
  const total = clean.reduce((a, b) => a + b, 0);
  if (total <= 0) return { ...DEFAULT_WEIGHTS };

  const exact = clean.map((n) => (n / total) * 100);
  const floored = exact.map((n) => Math.floor(n));
  let drift = 100 - floored.reduce((a, b) => a + b, 0);
  const order = exact.map((n, i) => ({ i, frac: n - Math.floor(n) })).sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (drift <= 0) break;
    floored[i] += 1;
    drift -= 1;
  }

  const out = {} as Weights;
  WEIGHT_KEYS.forEach((k, i) => {
    out[k] = floored[i];
  });
  return out;
}

/**
 * Moving one slider redistributes the remainder across the others in
 * proportion, so the control can never leave portals.yml in a state the
 * scanner would renormalize behind the user's back.
 */
export function rebalanceWeights(current: Weights, key: WeightKey, next: number): Weights {
  const value = Math.max(0, Math.min(100, Math.round(next)));
  const others = WEIGHT_KEYS.filter((k) => k !== key);
  const remaining = 100 - value;
  const otherTotal = others.reduce((a, k) => a + current[k], 0);

  const out = { ...current, [key]: value } as Weights;
  if (otherTotal <= 0) {
    // Everything else is zero — spread the remainder evenly rather than
    // leaving the sliders stuck at a sum below 100.
    const share = Math.floor(remaining / others.length);
    others.forEach((k) => (out[k] = share));
    out[others[0]] += remaining - share * others.length;
    return out;
  }

  let assigned = 0;
  others.forEach((k, i) => {
    const share =
      i === others.length - 1 ? remaining - assigned : Math.round((current[k] / otherTotal) * remaining);
    out[k] = Math.max(0, share);
    assigned += out[k];
  });
  return out;
}

export function sameWeights(a: Weights, b: Weights): boolean {
  return WEIGHT_KEYS.every((k) => a[k] === b[k]);
}
