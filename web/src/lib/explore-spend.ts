"use client";

// Blueprint S04 · gap 6 — an AI hunt must state its estimated spend BEFORE it
// runs and its actual spend AFTER, in the same row. The estimate is only honest
// if it comes from this machine's own history, so the first run quotes a
// documented typical figure and every run after quotes the rolling mean of what
// this user's CLI actually charged.

const KEY = "career-ops:explore-spend";
const KEEP = 5;

/** Typical Claude Code hunt: ~4 searches, ~6 page fetches. Used until we have real data. */
const DEFAULT_USD = 0.05;

export type SpendSample = { usd: number; tokens: number; at: number };

export type SpendEstimate = {
  usd: number;
  basis: "history" | "default";
  runs: number;
};

function readSamples(): SpendSample[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s): s is SpendSample => !!s && typeof s === "object" && typeof (s as SpendSample).usd === "number")
      .slice(-KEEP);
  } catch {
    return [];
  }
}

export function recordSpend(usd: number, tokens: number): void {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(usd) || usd <= 0) return;
  const next = [...readSamples(), { usd, tokens, at: Date.now() }].slice(-KEEP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — an estimate is not worth failing a run over */
  }
}

export function estimateSpend(): SpendEstimate {
  const samples = readSamples();
  if (samples.length === 0) return { usd: DEFAULT_USD, basis: "default", runs: 0 };
  const mean = samples.reduce((a, s) => a + s.usd, 0) / samples.length;
  return { usd: mean, basis: "history", runs: samples.length };
}

/** Small amounts read better with more precision than a currency formatter gives. */
export function fmtUsd(usd: number): string {
  if (!Number.isFinite(usd)) return "—";
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}
