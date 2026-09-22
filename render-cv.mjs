#!/usr/bin/env node

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderHtml, validateCvPayload } from './build-cv-html.mjs';
import { renderHtmlToPdf } from './generate-pdf.mjs';
import { resolveCvRenderConfig, stampCvRenderMetadata } from './cv-render-config.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  const flags = Object.fromEntries(argv.filter((arg) => arg.startsWith('--')).map((arg) => {
    const [key, ...rest] = arg.slice(2).split('=');
    return [key, rest.join('=') || true];
  }));
  return { payloadPath: positional[0], htmlPath: positional[1], pdfPath: positional[2], flags };
}

function inRoot(file) {
  const rel = relative(ROOT, resolve(file));
  return rel && !rel.startsWith('..') && !isAbsolute(rel);
}

function sourceReport(reportNum) {
  if (!reportNum) return '';
  try {
    const name = readdirSync(resolve(ROOT, 'reports')).find((file) => file.endsWith('.md') && Number.parseInt(file, 10) === Number.parseInt(reportNum, 10));
    return name ? `reports/${name}` : '';
  } catch { return ''; }
}

export async function renderCvArtifact({
  payloadPath,
  htmlPath,
  pdfPath,
  reportNum = '',
  template,
  pageFormat,
  profilePath = resolve(ROOT, 'config/profile.yml'),
  verifyFacts,
  launchBrowser,
  recordManifest = true,
} = {}) {
  if (!payloadPath || !htmlPath || !pdfPath) throw new Error('payload, HTML output, and PDF output are required');
  if (!inRoot(htmlPath) || !inRoot(pdfPath)) throw new Error('CV outputs must stay inside the career-ops directory');
  const payload = JSON.parse(readFileSync(resolve(payloadPath), 'utf8'));
  const validation = validateCvPayload(payload, { requireContract: true });
  if (!validation.ok) throw new Error(`Invalid tailored-CV payload: ${validation.errors.join('; ')}`);

  const config = resolveCvRenderConfig({
    profilePath,
    template,
    pageFormat,
  });
  payload.page_format = config.pageFormat;
  payload.style = config.style;
  const source = sourceReport(reportNum);
  if (reportNum && !source) throw new Error(`No evaluation report found for report ${reportNum}`);
  const templateHtml = readFileSync(config.templatePath, 'utf8');
  const html = stampCvRenderMetadata(renderHtml(templateHtml, payload), config, source);
  mkdirSync(dirname(resolve(htmlPath)), { recursive: true });
  writeFileSync(resolve(htmlPath), html, 'utf8');

  if (verifyFacts) {
    await verifyFacts(resolve(htmlPath));
  } else {
    const factGate = spawnSync(process.execPath, [resolve(ROOT, 'verify-cv-facts.mjs'), resolve(htmlPath)], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    if (factGate.status !== 0) throw new Error((factGate.stderr || factGate.stdout || 'CV fact verification failed').trim());
  }

  const expectedSections = ['summary', 'experience', 'education', 'skills']
    .filter((key) => key === 'summary' ? payload.summary : Array.isArray(payload[key]) && payload[key].length)
    .map((key) => payload.sections?.[key] || ({ summary: 'Professional Summary', experience: 'Work Experience', education: 'Education', skills: 'Skills' })[key]);

  const result = await renderHtmlToPdf(html, resolve(pdfPath), {
    format: config.pageFormat,
    baseDir: dirname(resolve(htmlPath)),
    reportNum,
    inputPath: resolve(htmlPath),
    template: config.template,
    templateVersion: config.templateVersion,
    styleVersion: config.styleVersion,
    rendererVersion: config.rendererVersion,
    sourceReport: source,
    expectedSections,
    requireManifest: recordManifest,
    skipManifest: !recordManifest,
    launchBrowser,
  });
  return { ...result, htmlPath: resolve(htmlPath), config, sourceReport: source };
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const { payloadPath, htmlPath, pdfPath, flags } = parseArgs(process.argv.slice(2));
  if (!payloadPath || !htmlPath || !pdfPath) {
    console.error('Usage: node render-cv.mjs <payload.json> <output.html> <output.pdf> [--report=NNN] [--template=name] [--format=a4|letter]');
    process.exit(1);
  }
  renderCvArtifact({
    payloadPath,
    htmlPath,
    pdfPath,
    reportNum: typeof flags.report === 'string' ? flags.report : '',
    template: typeof flags.template === 'string' ? flags.template : undefined,
    pageFormat: flags.format === 'a4' || flags.format === 'letter' ? flags.format : undefined,
  }).then((result) => {
    console.log(JSON.stringify({ ok: true, ...result, config: { ...result.config, templatePath: undefined } }, null, 2));
  }).catch((error) => {
    console.error(`CV render failed: ${error.message}`);
    process.exit(1);
  });
}
