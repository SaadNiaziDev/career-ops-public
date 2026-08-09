#!/usr/bin/env node
/**
 * patterns-signals.mjs — Distill tracker outcomes into data/ranking-signals.yml
 * for scan fit-score multipliers. Run after ≥5 tracked outcomes.
 *
 * Usage:
 *   node patterns-signals.mjs           # write data/ranking-signals.yml
 *   node patterns-signals.mjs --json    # stdout only
 *   node patterns-signals.mjs --dry-run # preview without write
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { spawnSync } from 'child_process';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = join(ROOT, 'data', 'ranking-signals.yml');

const args = process.argv.slice(2);
const jsonOnly = args.includes('--json');
const dryRun = args.includes('--dry-run');

function runAnalyzePatterns() {
  const r = spawnSync(process.execPath, [join(ROOT, 'analyze-patterns.mjs')], {
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || 'analyze-patterns.mjs failed');
  }
  return JSON.parse(r.stdout);
}

function buildSignals(analysis) {
  const total = analysis?.metadata?.total ?? analysis?.vendorAnalysis?.submitted ?? 0;
  const signals = {
    generated_at: new Date().toISOString().slice(0, 10),
    sample_size: total,
    min_sample: 10,
    ats_provider: {},
    company_size: {},
    comp_band: {},
    archetype: {},
    insights: [],
  };

  if (total < 5) {
    signals.insights.push("Need at least 5 tracked outcomes before ranking signals apply.");
    return signals;
  }

  const va = analysis?.vendorAnalysis;
  if (va?.breakdown && Array.isArray(va.breakdown)) {
    for (const v of va.breakdown) {
      if (!v?.vendor || (v.total ?? 0) < 3) continue;
      const rate = (v.advanceRate ?? 0) / 100;
      signals.ats_provider[String(v.vendor).toLowerCase()] = {
        total: v.total,
        advance_rate: Math.round(rate * 100) / 100,
      };
    }
  }

  const archetypes = analysis?.archetypeBreakdown;
  if (Array.isArray(archetypes)) {
    for (const a of archetypes) {
      if (!a?.archetype || (a.total ?? 0) < 3) continue;
      signals.archetype[a.archetype] = {
        total: a.total,
        advance_rate: Math.round(((a.conversionRate ?? 0) / 100) * 100) / 100,
      };
    }
  }

  const via = analysis?.viaChannelAnalysis;
  if (via?.agencyAdvanceRate != null && via?.directAdvanceRate != null && via.agencySubmitted >= 3) {
    signals.insights.push(
      `Agency channel advance ${via.agencyAdvanceRate}% vs direct ${via.directAdvanceRate}% (${via.agencySubmitted} agency submissions).`,
    );
  }

  const sc = analysis?.scoreComparison;
  if (sc?.positive?.avg != null && sc?.negative?.avg != null) {
    signals.insights.push(`Applied avg score ${sc.positive.avg} vs rejected ${sc.negative.avg}.`);
  }

  if (total >= 10 && Object.keys(signals.ats_provider).length) {
    const best = Object.entries(signals.ats_provider).sort((a, b) => b[1].advance_rate - a[1].advance_rate)[0];
    if (best) {
      signals.insights.push(`${total} evaluations → best response rate from ${best[0]} boards (${Math.round(best[1].advance_rate * 100)}% advance).`);
    }
  }

  return signals;
}

try {
  const analysis = runAnalyzePatterns();
  const signals = buildSignals(analysis);
  if (jsonOnly) {
    process.stdout.write(JSON.stringify(signals, null, 2) + '\n');
    process.exit(0);
  }
  if (!dryRun) {
    mkdirSync(dirname(OUT_PATH), { recursive: true });
    writeFileSync(OUT_PATH, yaml.dump(signals, { lineWidth: 100, noRefs: true }), 'utf-8');
    process.stderr.write(`Wrote ${OUT_PATH} (${signals.sample_size} outcomes)\n`);
  }
  process.stdout.write(JSON.stringify({ ok: true, path: OUT_PATH, sample_size: signals.sample_size }, null, 2) + '\n');
} catch (err) {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
}
