#!/usr/bin/env node
/**
 * fit-score.mjs — Heuristic 0–100 fit score for scan offers (zero AI tokens).
 * Consumes cv.md keywords, title_filter, profile comp band, posting age, trust flags,
 * optional portals.yml ranking weights, and data/ranking-signals.yml multipliers.
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CV_PATH = process.env.CAREER_OPS_CV || join(ROOT, 'cv.md');
const PROFILE_PATH = process.env.CAREER_OPS_PROFILE || join(ROOT, 'config', 'profile.yml');
const SIGNALS_PATH = join(ROOT, 'data', 'ranking-signals.yml');

const DEFAULT_WEIGHTS = {
  cv_overlap: 0.35,
  title_match: 0.25,
  comp_fit: 0.15,
  freshness: 0.15,
  trust: 0.10,
};

function tokenize(text) {
  if (typeof text !== 'string' || !text.trim()) return new Set();
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9+#.\-/ ]+/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 2 && t.length <= 40),
  );
}

function loadCvTokens() {
  try {
    if (!existsSync(CV_PATH)) return new Set();
    return tokenize(readFileSync(CV_PATH, 'utf-8'));
  } catch {
    return new Set();
  }
}

function parseCompRange(profile) {
  const raw = profile?.compensation?.target_range ?? profile?.compensation?.min_max ?? '';
  const s = String(raw);
  const nums = s.match(/\d[\d,]*/g)?.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter(Number.isFinite) ?? [];
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  if (nums.length === 1) return { min: nums[0] * 0.85, max: nums[0] * 1.15 };
  return null;
}

function parseOfferSalary(offer) {
  const raw = offer?.salary ?? offer?.compensation ?? '';
  const s = typeof raw === 'string' ? raw : JSON.stringify(raw);
  const nums = s.match(/\d[\d,]*/g)?.map((n) => parseInt(n.replace(/,/g, ''), 10)).filter(Number.isFinite) ?? [];
  if (!nums.length) return null;
  if (nums.length >= 2) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]) };
  return { min: nums[0], max: nums[0] };
}

function compFitScore(offer, compRange) {
  if (!compRange) return 70;
  const offerComp = parseOfferSalary(offer);
  if (!offerComp) return 55;
  const mid = (offerComp.min + offerComp.max) / 2;
  if (mid >= compRange.min && mid <= compRange.max) return 100;
  if (mid < compRange.min) {
    const gap = (compRange.min - mid) / Math.max(compRange.min, 1);
    return Math.max(0, Math.round(100 - gap * 120));
  }
  const gap = (mid - compRange.max) / Math.max(compRange.max, 1);
  return Math.max(40, Math.round(100 - gap * 80));
}

function titleMatchScore(title, positives, matchedKeyword) {
  if (!title || !positives?.length) return matchedKeyword ? 85 : 50;
  const lower = title.toLowerCase();
  let best = 0;
  for (const kw of positives) {
    if (!kw) continue;
    const k = kw.toLowerCase();
    if (lower === k) best = Math.max(best, 100);
    else if (lower.includes(k)) best = Math.max(best, k.length >= 8 ? 95 : 80);
    else if (k.split(/\s+/).every((w) => lower.includes(w))) best = Math.max(best, 70);
  }
  if (matchedKeyword && best < 80) best = 80;
  return best || 40;
}

function cvOverlapScore(title, description, cvTokens) {
  if (!cvTokens.size) return 50;
  const hay = `${title || ''} ${description || ''}`.toLowerCase();
  const words = tokenize(hay);
  if (!words.size) return 50;
  let hits = 0;
  for (const t of cvTokens) {
    if (words.has(t) || hay.includes(t)) hits++;
  }
  const ratio = hits / Math.min(cvTokens.size, 80);
  return Math.min(100, Math.round(ratio * 140));
}

function freshnessScore(postedAt, maxAgeDays = 30) {
  if (typeof postedAt !== 'number' || !Number.isFinite(postedAt) || postedAt <= 0) return 45;
  const days = Math.max(0, (Date.now() - postedAt) / 86_400_000);
  if (days <= 3) return 100;
  if (days >= maxAgeDays) return 20;
  return Math.round(100 - ((days - 3) / Math.max(maxAgeDays - 3, 1)) * 80);
}

function trustScore(offer) {
  if (typeof offer.trustScore === 'number') return Math.max(0, Math.min(100, offer.trustScore));
  const flags = Array.isArray(offer.trustFlags) ? offer.trustFlags.length : 0;
  return Math.max(0, 100 - flags * 18);
}

function loadRankingWeights(portalsConfig) {
  const w = portalsConfig?.ranking?.weights;
  if (!w || typeof w !== 'object') return { ...DEFAULT_WEIGHTS };
  return {
    cv_overlap: Number(w.cv_overlap) || DEFAULT_WEIGHTS.cv_overlap,
    title_match: Number(w.title_match) || DEFAULT_WEIGHTS.title_match,
    comp_fit: Number(w.comp_fit) || DEFAULT_WEIGHTS.comp_fit,
    freshness: Number(w.freshness) || DEFAULT_WEIGHTS.freshness,
    trust: Number(w.trust) || DEFAULT_WEIGHTS.trust,
  };
}

function loadSignals() {
  try {
    if (!existsSync(SIGNALS_PATH)) return null;
    return yaml.load(readFileSync(SIGNALS_PATH, 'utf-8')) || null;
  } catch {
    return null;
  }
}

function signalMultiplier(offer, signals) {
  if (!signals || typeof signals !== 'object') return { mult: 1, reasons: [] };
  const reasons = [];
  let delta = 0;
  const source = String(offer.source || '').replace(/-full$/, '').replace(/-api$/, '').toLowerCase();
  const atsRates = signals.ats_provider ?? signals.ats ?? {};
  if (source && atsRates[source]) {
    const rate = Number(atsRates[source].advance_rate ?? atsRates[source].rate ?? 0);
    if (rate > 0) {
      const bump = Math.min(15, Math.round((rate - 0.15) * 40));
      if (bump !== 0) {
        delta += bump;
        reasons.push(`interviews from ${source}: ${bump > 0 ? '+' : ''}${bump}`);
      }
    }
  }
  const mult = 1 + Math.max(-0.15, Math.min(0.15, delta / 100));
  return { mult, reasons };
}

/**
 * @param {object} offer
 * @param {object} ctx — { cvTokens?, compRange?, positives?, matchedKeyword?, weights?, signals?, maxAgeDays? }
 */
export function computeFitScore(offer, ctx = {}) {
  const weights = ctx.weights || DEFAULT_WEIGHTS;
  const cvTokens = ctx.cvTokens || loadCvTokens();
  const compRange = ctx.compRange ?? (ctx.profile ? parseCompRange(ctx.profile) : null);
  const positives = ctx.positives || [];
  const matchedKeyword = ctx.matchedKeyword;

  const components = {
    cv_overlap: cvOverlapScore(offer.title, offer.description, cvTokens),
    title_match: titleMatchScore(offer.title, positives, matchedKeyword),
    comp_fit: compFitScore(offer, compRange),
    freshness: freshnessScore(offer.postedAt, ctx.maxAgeDays ?? 30),
    trust: trustScore(offer),
  };

  const wSum = weights.cv_overlap + weights.title_match + weights.comp_fit + weights.freshness + weights.trust;
  let raw =
    (components.cv_overlap * weights.cv_overlap +
      components.title_match * weights.title_match +
      components.comp_fit * weights.comp_fit +
      components.freshness * weights.freshness +
      components.trust * weights.trust) /
    (wSum || 1);

  const signals = ctx.signals ?? loadSignals();
  const { mult, reasons } = signalMultiplier(offer, signals);
  raw = Math.round(raw * mult);

  const fitScore = Math.max(0, Math.min(100, raw));
  return { fitScore, components, signalReasons: reasons, signalMultiplier: mult };
}

export function buildFitScoreContext(portalsConfig, options = {}) {
  let profile = options.profile;
  if (!profile) {
    try {
      if (existsSync(PROFILE_PATH)) profile = yaml.load(readFileSync(PROFILE_PATH, 'utf-8')) || {};
    } catch {
      profile = {};
    }
  }
  return {
    cvTokens: loadCvTokens(),
    compRange: parseCompRange(profile),
    positives: portalsConfig?.title_filter?.positive || [],
    weights: loadRankingWeights(portalsConfig),
    signals: loadSignals(),
    profile,
    maxAgeDays: portalsConfig?.max_posting_age_days ?? 30,
  };
}

export function attachFitScores(offers, portalsConfig, options = {}) {
  const ctx = buildFitScoreContext(portalsConfig, options);
  return offers.map((offer) => {
    const matchedKeyword = options.matchedKeywordFor?.(offer);
    const result = computeFitScore(offer, { ...ctx, matchedKeyword });
    return {
      ...offer,
      fitScore: result.fitScore,
      fitComponents: result.components,
      fitSignalReasons: result.signalReasons,
    };
  });
}
