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
const TEMPLATES = ['standard'];
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

test('base template renders links, promotions, project bullets, open source, and awards', () => {
  const payload = {
    ...fixture('short'),
    candidate: { ...fixture('short').candidate, github: { url: 'https://github.com/example', display: 'github.com/example' } },
    experience: [{
      company: 'Example Systems', company_url: 'example.com', role: 'Engineer',
      promotion: 'promoted from Intern', dates: '2021 - Present', bullets: ['Shipped **R&D** tooling.'],
    }],
    projects: [{
      name: 'Release Console', tech: 'TypeScript', link: { url: 'https://example.com/rc', display: 'Live demo' },
      bullets: ['First point.', 'Second point.'],
    }],
    open_source: [{ project: 'Example OSS', url: 'https://github.com/example/oss', detail: '3 merged PRs', bullets: ['Added theming.'] }],
    awards: [{ title: 'Employee of the Month', detail: 'twice' }],
    certifications: [],
  };
  const dense = renderHtml(readFileSync(resolve(ROOT, 'templates/cv-template.html'), 'utf8'), payload);
  assert.match(dense, /<a class="job-company-link" href="https:\/\/example\.com">Example Systems<\/a>/);
  assert.match(dense, /<span class="job-promotion">\(promoted from Intern\)<\/span>/);
  assert.match(dense, /Shipped <strong>R&amp;D<\/strong> tooling\./);
  assert.match(dense, /<ul class="project-bullets">[\s\S]*<li>First point\.<\/li>[\s\S]*<li>Second point\.<\/li>/);
  assert.match(dense, /<a class="project-link" href="https:\/\/example\.com\/rc">Live demo<\/a>/);
  assert.match(dense, /href="https:\/\/github\.com\/example">github\.com\/example<\/a>/);
  assert.match(dense, /Example OSS[\s\S]*3 merged PRs/);
  assert.match(dense, /<span class="award-title">Employee of the Month<\/span> — twice/);
  assert.doesNotMatch(dense, /<!-- CERTIFICATIONS -->/, 'empty certifications dropped by drop-empty-sections');

  // Custom templates without the project-bullets feature keep the joined one-line fallback.
  const plain = renderHtml('<!-- PROJECTS -->{{PROJECTS}}\n<!-- EDUCATION -->{{EDUCATION}}', payload);
  assert.match(plain, /<div class="project-desc">First point\. Second point\.<\/div>/);
  assert.doesNotMatch(plain, /project-bullets/);

  // Empty optional sections leave no bare header.
  const bare = renderHtml(readFileSync(resolve(ROOT, 'templates/cv-template.html'), 'utf8'), { ...payload, open_source: [], awards: [] });
  assert.doesNotMatch(bare, /<!-- OPEN SOURCE -->|<!-- AWARDS -->/);
  assert.match(bare, /<!-- EDUCATION -->/);
});

test('contract accepts open_source and awards but rejects non-array shapes', () => {
  assert.equal(validateCvPayload({ ...fixture('short'), open_source: [], awards: [] }, { requireContract: true }).ok, true);
  const bad = validateCvPayload({ ...fixture('short'), awards: 'Employee of the Month' }, { requireContract: true });
  assert.equal(bad.ok, false);
  assert.match(bad.errors.join(' '), /awards must be an array/);
});

test('canonical config owns custom style, template, and paper size', () => {
  const dir = mkdtempSync(join(tmpdir(), 'co-cv-config-'));
  const profile = join(dir, 'profile.yml');
  writeFileSync(profile, 'cv:\n  template: standard\n  page_format: a4\n  style:\n    accent_color: "#123456"\n    density: spacious\n');
  const config = resolveCvRenderConfig({ profilePath: profile });
  assert.equal(config.template, 'standard');
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
  writeFileSync(profile, 'cv:\n  template: standard\n  page_format: a4\n  style:\n    accent_color: "#0f766e"\n    density: compact\n');
  writeFileSync(payload, JSON.stringify(fixture('long')));
  const result = await renderCvArtifact({
    payloadPath: payload,
    htmlPath: html,
    pdfPath: pdf,
    profilePath: profile,
    verifyFacts: async () => undefined,
    recordManifest: false,
  });
  assert.equal(result.config.template, 'standard');
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
