import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { renderHtml, validateCvPayload } from '../build-cv-html.mjs';
import { resolveCvRenderConfig, stampCvRenderMetadata } from '../cv-render-config.mjs';
import { updatePDFManifest } from '../generate-pdf.mjs';
import { renderCvArtifact } from '../render-cv.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const FIXTURES = resolve(import.meta.dirname, 'fixtures/cv-render');
const TEMPLATES = ['academic', 'compact', 'modern', 'standard'];
const STYLE = { accent_color: '#0f766e', heading_color: '#172554', density: 'standard' };

function fixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8'));
}

test('tailored CV contract rejects missing and layout-bearing fields', () => {
  assert.equal(validateCvPayload({ contract_version: '1.0' }, { requireContract: true }).ok, false);
  const invalid = { ...fixture('short'), style: { density: 'compact' }, page_format: 'a4' };
  const result = validateCvPayload(invalid, { requireContract: true });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /unknown top-level field: style/);
});

test('all shipped templates match short and long visual-markup baselines', () => {
  const baselines = fixture('baselines');
  for (const size of ['short', 'long']) {
    for (const template of TEMPLATES) {
      const payload = fixture(size);
      const config = resolveCvRenderConfig({
        profilePath: '/dev/null',
        template,
        pageFormat: size === 'short' ? 'letter' : 'a4',
        style: { ...STYLE, density: size === 'short' ? 'standard' : 'compact' },
      });
      payload.page_format = config.pageFormat;
      payload.style = config.style;
      const html = stampCvRenderMetadata(renderHtml(readFileSync(config.templatePath, 'utf8'), payload), config);
      assert.equal(createHash('sha256').update(html).digest('hex'), baselines[size][template], `${size}/${template}`);
      assert.match(html, new RegExp(`career-ops-template" content="${template}`));
      assert.doesNotMatch(html, /\{\{[A-Z_]+\}\}/);
    }
  }
});

test('canonical config owns custom style, template, and paper size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'co-cv-config-'));
  const profile = join(dir, 'profile.yml');
  writeFileSync(profile, 'cv:\n  template: modern\n  page_format: a4\n  style:\n    accent_color: "#123456"\n    density: spacious\n');
  const config = resolveCvRenderConfig({ profilePath: profile });
  assert.equal(config.template, 'modern');
  assert.equal(config.pageFormat, 'a4');
  assert.equal(config.style.accent_color, '#123456');
  assert.equal(config.style.density, 'spacious');
  rmSync(dir, { recursive: true, force: true });
});

test('artifact manifest records template, style, renderer, and source report', () => {
  const dir = mkdtempSync(join(tmpdir(), 'co-cv-manifest-'));
  const manifestPath = join(dir, 'pdf-index.tsv');
  const pdf = join(ROOT, 'output', 'fixture.pdf');
  const html = join(ROOT, 'output', 'fixture.html');
  updatePDFManifest('007', pdf, html, 'a4', {
    template: 'modern', templateVersion: '1.2.0', styleVersion: 'abc123',
    sourceReport: 'reports/007-example.md', rendererVersion: 'cv-render-v1', manifestPath,
  });
  const text = readFileSync(manifestPath, 'utf8');
  assert.match(text, /007\toutput\/fixture\.pdf\toutput\/fixture\.html\ta4\t\d{4}-\d{2}-\d{2}\tmodern\t1\.2\.0\tabc123\treports\/007-example\.md\tcv-render-v1/);
  rmSync(dir, { recursive: true, force: true });
});

test('canonical CLI renderer produces a readable PDF with expected sections', { timeout: 30_000 }, async () => {
  const dir = resolve(ROOT, 'tmp/pdfs/cv-render-test');
  rmSync(dir, { recursive: true, force: true });
  const profile = join(dir, 'profile.yml');
  const payload = join(dir, 'payload.json');
  const html = join(dir, 'cv.html');
  const pdf = join(dir, 'cv.pdf');
  await import('node:fs/promises').then((fs) => fs.mkdir(dir, { recursive: true }));
  writeFileSync(profile, 'cv:\n  template: compact\n  page_format: a4\n  style:\n    accent_color: "#0f766e"\n    density: compact\n');
  writeFileSync(payload, JSON.stringify(fixture('long')));
  const result = await renderCvArtifact({
    payloadPath: payload,
    htmlPath: html,
    pdfPath: pdf,
    profilePath: profile,
    verifyFacts: async () => undefined,
    recordManifest: false,
  });
  assert.equal(result.config.template, 'compact');
  assert.equal(result.config.pageFormat, 'a4');
  assert.ok(existsSync(pdf));
  assert.equal(readFileSync(pdf).subarray(0, 5).toString('ascii'), '%PDF-');
  const textProbe = spawnSync('pdftotext', [pdf, '-'], { encoding: 'utf8' });
  if (!textProbe.error) {
    assert.equal(textProbe.status, 0);
    assert.match(textProbe.stdout, /Professional Summary/i);
    assert.match(textProbe.stdout, /Work Experience/i);
  }
  rmSync(dir, { recursive: true, force: true });
});

test('web worker delegates layout to render-cv and never instructs HTML editing', () => {
  const source = readFileSync(resolve(ROOT, 'web/src/app/api/run/route.ts'), 'utf8');
  const prompt = source.match(/if \(kind === "pdf"\) \{([\s\S]*?)\n  \}/)?.[1] || '';
  assert.match(prompt, /render-cv\.mjs/);
  assert.match(prompt, /Never create or edit HTML\/CSS/);
  assert.doesNotMatch(prompt, /Fill templates\/cv-template\.html/);
  const preview = readFileSync(resolve(ROOT, 'web/src/app/api/cv/preview/route.ts'), 'utf8');
  const studioExport = readFileSync(resolve(ROOT, 'web/src/app/api/cv/pdf/route.ts'), 'utf8');
  assert.match(preview, /renderCvPreviewHtml/);
  assert.match(studioExport, /renderCvPreviewHtml/);
  assert.match(studioExport, /--no-manifest/);
});
