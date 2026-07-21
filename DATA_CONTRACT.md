# Data Contract

Defines which files belong to the **system** (auto-updatable) vs **user** (never touched by updates).

This fork is UI-first: the web app (`web/`) and Node scripts share the same files below.

## User Layer (NEVER auto-updated)

| File | Purpose |
|------|---------|
| `cv.md` | Your CV in markdown |
| `config/profile.yml` | Identity, targets, comp range, spend tier |
| `config/cv-facts.json` | CV fact-check allowlist (optional) |
| `config/benchmarks.yml` | Market calibration overrides (optional) |
| `modes/_profile.md` | Archetypes, narrative, negotiation scripts |
| `modes/_custom.md` | House rules, workflows, output preferences |
| `voice-dna.md` | Writing voice guardrail (optional) |
| `article-digest.md` | Proof points from portfolio |
| `interview-prep/story-bank.md` | STAR+R stories |
| `interview-prep/{company}-{role}.md` | Company-specific interview prep |
| `interview-prep/sessions/*.md` | Session transcripts (gitignored except scaffold) |
| `portals.yml` | Customized company / scan config |
| `data/applications.md` | Application tracker |
| `data/pipeline.md` | URL inbox |
| `data/scan-history.tsv` | Scan dedup history |
| `data/scan-runs.tsv` | Per-run scan counters |
| `data/follow-ups.md` | Follow-up history |
| `data/contacts.tsv` | Outreach contacts linked to tracker rows |
| `data/drafts/*` | Cover letter, email, and contact outreach drafts |
| `data/titles-suggestions.json` | CV-driven adjacent title suggestions (titles mode) |
| `data/offers/*` | Received offers/contracts and prep reports (PII — gitignored) |
| `data/blacklist.md` | Do-not-apply list (opt-in) |
| `data/salary-observations.tsv` | Compensation observations |
| `data/assessments.tsv` | Skills-assessment log |
| `writing-samples/*` | Personal writing samples |
| `reports/*` | Evaluation reports |
| `output/*` | Generated PDFs |
| `jds/*` | Saved job descriptions |
| `.claude/settings.json` | Local Claude Code settings |
| `.claude/hooks/` | Local hooks |

## System Layer (safe to auto-update)

| File | Purpose |
|------|---------|
| `modes/_shared.md` | Scoring, global rules |
| `modes/_profile.template.md` | Profile seed |
| `modes/_custom.template.md` | Custom rules seed |
| `modes/*.md` | Mode instructions (English) |
| `modes/offer-prep.md` | Offer/contract reading companion |
| `modes/titles.md` | Adjacent job-title suggestions |
| `modes/discover.md` | AI web search job discovery (Explore) |
| `modes/interview/*` | Interview sub-skills |
| `modes/heuristics/*` | Shared heuristics |
| `CLAUDE.md` / `CODEX.md` | Thin wrappers → `AGENTS.md` |
| `AGENTS.md` | Canonical agent instructions |
| `*.mjs` | Utility scripts |
| `plugins/_engine.mjs` | Minimal stub (scan compatibility) |
| `providers/` | Built-in portal providers |
| `batch/batch-prompt.md` | Batch worker prompt |
| `templates/*` | CV templates, states, examples |
| `.agents/skills/career-ops/` | Canonical skill router |
| `.claude/skills/career-ops/` | Claude entrypoint |
| `.cursor/skills/career-ops/` | Cursor entrypoint |
| `skill-entrypoints.mjs` | Skill bootstrap helper |
| `docs/*` | Documentation |
| `web/` | Web UI (excluded from updater path coverage; own lifecycle) |
| `VERSION`, `DATA_CONTRACT.md`, `README.md` | Meta |

## The Rule

**User layer:** no update process may read, modify, or delete these files.

**System layer:** may be replaced from this fork's remote on `update-system.mjs apply`.

When customizing facts → `modes/_profile.md` or `config/profile.yml`. When customizing procedures → `modes/_custom.md`.
