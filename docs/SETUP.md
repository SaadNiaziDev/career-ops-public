# Setup Guide

UI-first local job search automation. Primary surface: `npm run web:dev` → http://localhost:3000.

## Prerequisites

- [Node.js](https://nodejs.org) 18+
- `git`
- An AI coding CLI — [Claude Code](https://claude.ai/code), Codex, or Cursor (see [docs/CODEX.md](CODEX.md))
- (Optional) Playwright Chromium for PDF generation and browser-heavy modes

## Quick Start

```bash
git clone https://github.com/SaadNiaziDev/career-ops-public.git career-ops
cd career-ops
npm install
npm run web:install
npx playwright install chromium
npm run web:dev
```

Open http://localhost:3000. On first run, a setup wizard walks you through **(1) picking an AI CLI** and **(2) adding your CV** (PDF, `.md`, or paste). See [README.md](../README.md#how-to-get-cvmd-and-the-other-markdown-files) for other ways to gather the markdown files.

Or set it up by hand:

1. Copy `templates/portals.example.yml` → `portals.yml` (`node doctor.mjs --json` also copies this)
2. Copy `config/profile.example.yml` → `config/profile.yml`
3. Copy `modes/_profile.template.md` → `modes/_profile.md`
4. Create `cv.md` from your résumé (`examples/cv-example.md` is the heading guide)
5. Create `data/applications.md` from the template header if missing

Run health checks:

```bash
node doctor.mjs --json
node verify-pipeline.mjs
```

## Agent workflows

Paste a job URL in chat for **auto-pipeline**, or invoke modes from your CLI:

```bash
claude -p "Evaluate this JD with career-ops auto-pipeline: https://company.com/jobs/123"
codex exec "Run career-ops scan mode in this repo."
agent -p --force "Run career-ops scan mode in this repo."
```

**Codex note:** start an interactive session with `codex`. Slash commands are not guaranteed in Codex, so use plain-language prompts if `/career-ops` is unavailable:

```text
Evaluate this JD with career-ops auto-pipeline: https://company.com/jobs/123
Run the career-ops scan mode.
Run the career-ops pipeline mode for data/pipeline.md.
Run the career-ops pdf mode for the latest evaluated role.
```

For one-shot workers, use `codex exec`. See [docs/CODEX.md](CODEX.md).

## Common commands

| Action | Command |
|--------|---------|
| Web UI | `npm run web:dev` |
| Portal scan | `npm run scan` |
| Pipeline health | `node verify-pipeline.mjs` |
| Generate PDF | `npm run pdf` |
| Full test suite | `node test-all.mjs` |
| Public release check | `node verify-public-release.mjs` |

## Personal data stays local

Never commit `cv.md`, `config/profile.yml`, `portals.yml`, `modes/_profile.md`, tracker files, reports, or outputs. See `DATA_CONTRACT.md`.
