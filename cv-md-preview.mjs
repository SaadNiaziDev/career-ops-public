#!/usr/bin/env node
/**
 * cv-md-preview.mjs — Deterministic cv.md → HTML preview (zero AI tokens).
 * Parses common career-ops cv.md shapes and renders via build-cv-html.mjs.
 */

import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { renderHtml } from './build-cv-html.mjs';
import { resolveTemplate } from './cv-templates.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DEFAULT_PROFILE = process.env.CAREER_OPS_PROFILE || join(ROOT, 'config', 'profile.yml');

function stripCvPrefix(title) {
  return title.replace(/^CV\s*[-–—:]\s*/i, '').trim();
}

function parseMetaLine(line) {
  const m = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
  if (!m) return null;
  return { key: m[1].trim().toLowerCase(), value: m[2].trim() };
}

function splitSections(md) {
  const sections = [];
  let current = { title: '', lines: [] };
  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      if (current.title || current.lines.length) sections.push(current);
      current = { title: h2[1].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.title || current.lines.length) sections.push(current);
  return sections;
}

function sectionBody(lines) {
  return lines.join('\n').trim();
}

function parseBullets(text) {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s+/, '').trim())
    .filter(Boolean);
}

function parseExperience(text) {
  const entries = [];
  const blocks = text.split(/\n(?=###\s+)/).filter(Boolean);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const head = lines[0].replace(/^###\s+/, '');
    const companyPart = head.split(/\s*[-–—|@]\s*/)[0]?.trim() || head.trim();
    const location = head.includes('—') ? head.split('—').slice(1).join('—').trim() : head.split('--').slice(1).join('--').trim();
    let role = '';
    let dates = '';
    const bullets = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const bold = line.match(/^\*\*(.+?)\*\*$/);
      if (bold && !role) {
        role = bold[1].trim();
        continue;
      }
      if (/^\d{4}\s*[-–—]\s*(\d{4}|present|now|current)/i.test(line) && !dates) {
        dates = line;
        continue;
      }
      if (/^[-*•]/.test(line)) bullets.push(line.replace(/^\s*[-*•]\s+/, '').trim());
    }
    if (companyPart) entries.push({ company: companyPart, role: role || 'Role', location: location || '', dates: dates || '', bullets });
  }
  if (entries.length) return entries;

  // Fallback: single block with bullets only
  const bullets = parseBullets(text);
  if (bullets.length) return [{ company: 'Experience', role: '', location: '', dates: '', bullets }];
  return [];
}

function parseProjects(text) {
  return parseBullets(text).map((line) => {
    const bold = line.match(/^\*\*(.+?)\*\*\s*[-–—]?\s*(.*)$/);
    if (bold) return { name: bold[1].trim(), badge: '', tech: '', description: bold[2].trim() || bold[1].trim() };
    return { name: line.slice(0, 80), badge: '', tech: '', description: line };
  });
}

function parseEducation(text) {
  return parseBullets(text).map((line) => {
    const parts = line.split(/,\s*/);
    return {
      title: parts[0] || line,
      org: parts[1] || '',
      year: (line.match(/\((\d{4})\)/) || line.match(/(\d{4})\s*$/))?.[1] || '',
      description: '',
    };
  });
}

function parseSkills(text) {
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);
    if (m) out.push({ category: m[1].trim(), items: m[2].split(',').map((s) => s.trim()).filter(Boolean) });
  }
  return out;
}

function profileCandidate(profile) {
  const c = profile?.candidate || {};
  return {
    name: c.full_name || c.name || '',
    headline: profile?.target_roles?.primary?.[0] || '',
    email: c.email || '',
    phone: c.phone || '',
    location: c.location || '',
    linkedin: c.linkedin ? { url: c.linkedin, display: c.linkedin.replace(/^https?:\/\//, '') } : undefined,
    portfolio: c.portfolio || c.website ? { url: c.portfolio || c.website, display: String(c.portfolio || c.website).replace(/^https?:\/\//, '') } : undefined,
  };
}

/** @param {string} md */
export function markdownToPreviewPayload(md, profile = {}) {
  const lines = md.split(/\r?\n/);
  let name = '';
  const meta = {};
  const preamble = [];

  for (const line of lines) {
    if (/^##\s/.test(line)) break;
    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      name = stripCvPrefix(h1[1]);
      continue;
    }
    const kv = parseMetaLine(line);
    if (kv) meta[kv.key] = kv.value;
    else if (line.trim()) preamble.push(line.trim());
  }

  const candidate = profileCandidate(profile);
  if (name) candidate.name = name;
  if (meta.email) candidate.email = meta.email;
  if (meta.phone || meta.tel) candidate.phone = meta.phone || meta.tel;
  if (meta.location) candidate.location = meta.location;
  if (meta.linkedin) {
    const url = meta.linkedin.startsWith('http') ? meta.linkedin : `https://${meta.linkedin}`;
    candidate.linkedin = { url, display: meta.linkedin.replace(/^https?:\/\//, '') };
  }
  if (meta.portfolio || meta.website || meta.github) {
    const raw = meta.portfolio || meta.website || meta.github;
    const url = raw.startsWith('http') ? raw : `https://${raw}`;
    candidate.portfolio = { url, display: raw.replace(/^https?:\/\//, '') };
  }

  const sections = splitSections(md);
  let summary = '';
  let experience = [];
  let projects = [];
  let education = [];
  let skills = [];
  let competencies = [];

  for (const s of sections) {
    const key = s.title.toLowerCase();
    const body = sectionBody(s.lines);
    if (/summary|about|profile/.test(key)) summary = body.replace(/\*\*/g, '');
    else if (/experience|employment|work history/.test(key)) experience = parseExperience(body);
    else if (/project/.test(key)) projects = parseProjects(body);
    else if (/education/.test(key)) education = parseEducation(body);
    else if (/skill|competen|technolog/.test(key)) {
      skills = parseSkills(body);
      if (!skills.length && body) competencies = parseBullets(body);
    } else if (/competen/.test(key)) competencies = parseBullets(body);
  }

  if (!summary && preamble.length) summary = preamble.join(' ');

  return {
    lang: profile?.language?.output === 'es' ? 'es' : 'en',
    page_format: profile?.cv?.page_format === 'a4' ? 'a4' : 'letter',
    candidate,
    summary,
    competencies,
    experience,
    projects,
    education,
    certifications: [],
    skills,
  };
}

export function renderCvPreview(md, opts = {}) {
  const profilePath = opts.profilePath || DEFAULT_PROFILE;
  let profile = {};
  if (existsSync(profilePath)) {
    try {
      profile = yaml.load(readFileSync(profilePath, 'utf-8')) || {};
    } catch {
      profile = {};
    }
  }
  const payload = markdownToPreviewPayload(md, profile);
  payload.style = opts.style || profile?.cv?.style || {};
  const templateName = opts.template || profile?.cv?.template || 'standard';
  const templatePath = resolveTemplate('cv', templateName, { profilePath, fallback: true });
  const template = readFileSync(templatePath, 'utf-8');
  // What the section parser actually found — lets callers tell "rendered fine" from
  // "rendered a header because the markdown uses non-standard headings".
  const stats = {
    summary: Boolean(payload.summary),
    experience: payload.experience.length,
    projects: payload.projects.length,
    education: payload.education.length,
    skills: payload.skills.length,
    competencies: payload.competencies.length,
  };
  return { html: renderHtml(template, payload), template: templateName, templatePath, stats };
}

function readStdin() {
  return readFileSync(0, 'utf-8');
}

function parseCliArgs(argv) {
  const out = { json: false, file: null, stdin: false, template: null, style: null, profilePath: DEFAULT_PROFILE };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') out.json = true;
    else if (a === '--stdin') out.stdin = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--template') out.template = argv[++i];
    else if (a === '--style-json') {
      try { out.style = JSON.parse(argv[++i] || '{}'); } catch { out.style = {}; }
    } else if (a === '--profile') out.profilePath = argv[++i];
  }
  return out;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const opts = parseCliArgs(process.argv.slice(2));
  let md = '';
  if (opts.file) {
    if (!existsSync(opts.file)) {
      process.stderr.write(`File not found: ${opts.file}\n`);
      process.exit(1);
    }
    md = readFileSync(opts.file, 'utf-8');
  } else if (opts.stdin) {
    md = readStdin();
  } else {
    process.stderr.write('Usage: node cv-md-preview.mjs --json (--file <path> | --stdin) [--template name] [--style-json \'{...}\']\n');
    process.exit(2);
  }
  try {
    const result = renderCvPreview(md, {
      template: opts.template || undefined,
      style: opts.style || undefined,
      profilePath: opts.profilePath,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify({ html: result.html, template: result.template, stats: result.stats }) + '\n');
    } else {
      process.stdout.write(result.html);
    }
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
