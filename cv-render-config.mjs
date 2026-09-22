import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { kebab, parseMeta, resolveTemplate } from './cv-templates.mjs';

export const CV_RENDERER_VERSION = 'cv-render-v1';
export const DEFAULT_CV_STYLE = {
  accent_color: '#2563eb',
  heading_color: '#1a1a2e',
  font_stack: "'Liberation Sans', 'Helvetica Neue', Arial, sans-serif",
  margin: '2px 0',
  density: 'standard',
};

const STYLE_KEYS = new Set(['accent_color', 'heading_color', 'font_stack', 'margin', 'density']);

function readProfile(profilePath) {
  if (!existsSync(profilePath)) return {};
  try { return yaml.load(readFileSync(profilePath, 'utf8')) || {}; } catch { return {}; }
}

function cleanStyle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, entry]) => STYLE_KEYS.has(key) && typeof entry === 'string'));
}

function shortHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

export function resolveCvRenderConfig({
  profilePath = resolve('config/profile.yml'),
  template,
  pageFormat,
  style,
} = {}) {
  const profile = readProfile(profilePath);
  const cv = profile.cv && typeof profile.cv === 'object' && !Array.isArray(profile.cv) ? profile.cv : {};
  const templateName = kebab(String(template || cv.template || 'standard')) || 'standard';
  const templatePath = resolveTemplate('cv', templateName, { profilePath });
  const format = pageFormat === 'a4' || pageFormat === 'letter'
    ? pageFormat
    : cv.page_format === 'a4' ? 'a4' : 'letter';
  const resolvedStyle = { ...DEFAULT_CV_STYLE, ...cleanStyle(cv.style), ...cleanStyle(style) };
  const meta = parseMeta(templatePath);
  const templateVersion = meta.version || shortHash(readFileSync(templatePath, 'utf8'));
  const styleVersion = shortHash(JSON.stringify(resolvedStyle));
  return {
    rendererVersion: CV_RENDERER_VERSION,
    template: templateName,
    templatePath,
    templateVersion,
    pageFormat: format,
    style: resolvedStyle,
    styleVersion,
  };
}

export function stampCvRenderMetadata(html, config, sourceReport = '') {
  const tags = [
    ['career-ops-renderer', config.rendererVersion],
    ['career-ops-template', config.template],
    ['career-ops-template-version', config.templateVersion],
    ['career-ops-style-version', config.styleVersion],
    ['career-ops-source-report', sourceReport],
  ].map(([name, content]) => `<meta name="${name}" content="${String(content).replace(/"/g, '&quot;')}">`).join('\n');
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tags}\n</head>`) : `${tags}\n${html}`;
}
