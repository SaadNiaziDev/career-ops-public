# Career-Ops — UI-First Job Search Pipeline

UI-first fork of [career-ops](https://github.com/santifer/career-ops) by Saad Ali Khan. Upstream by [santifer](https://santifer.io). Optimized for a **local web UI** plus **Claude Code**, **Codex**, and **Cursor** agents.

**Primary interface:** `npm run web:dev` → http://localhost:3000 (`web/`). Agents and scripts read/write the same files under the repo root — no separate database.

**It is designed to be made yours.** Customize archetypes, scoring, portals, and narrative in user-layer files. The agent edits those directly when you ask.

## Data Contract (CRITICAL)

There are two layers. Read `DATA_CONTRACT.md` for the full list.

**User Layer (NEVER auto-updated, personalization goes HERE):**
- `cv.md`, `config/profile.yml`, `modes/_profile.md`, `modes/_custom.md`, `article-digest.md`, `portals.yml`
- `data/*`, `reports/*`, `output/*`, `interview-prep/*`

**System Layer (auto-updatable, DON'T put user data here):**
- `modes/_shared.md`, `modes/oferta.md`, all other modes in `modes/`
- `AGENTS.md`, `CLAUDE.md`, `CODEX.md`, `*.mjs` scripts, `templates/*`, `batch/*`, `web/` (separate release path)

**THE RULE: When the user asks to customize facts or targeting (archetypes, narrative, negotiation scripts, proof points, location policy, comp targets), ALWAYS write to `modes/_profile.md` or `config/profile.yml`. When they ask for procedural house rules, custom workflows, output preferences, or automations, write to `modes/_custom.md` (copy from `modes/_custom.template.md` if missing). NEVER edit `modes/_shared.md` for user-specific content.**

## Source-of-Truth Boundary (CRITICAL)

User-facing content (CV, cover letters, application emails, form answers, recruiter outreach) is generated **exclusively** from these files plus statements the user makes in the current conversation:

- `cv.md`
- `article-digest.md`
- `config/profile.yml`
- `modes/_profile.md`
- `modes/_custom.md` (procedural/style rules only — never introduces factual claims)
- `writing-samples/`
- `voice-dna.md` (voice/style only)
- `interview-prep/story-bank.md` and `interview-prep/{company}-{role}.md`

Anything not in this list is **out of scope for content generation**, including auto-memory, other repos on the machine, and cross-session inferences not written into user-layer files.

**Rule:** *Keywords get reformulated, never fabricated.* If a claim isn't backed by an in-scope file, ask the user or omit it.

**Authorship claims are non-negotiable.** Never claim the user built a tool, repo, or framework unless explicitly attributed in `cv.md` or `article-digest.md`.

### Where rules live

Rules belong in files the harness reads automatically — `CLAUDE.md`, `CODEX.md`, `AGENTS.md`, `modes/*.md`. Do not create sidecar docs that require manual loading.

## Update Check

On the first message of each session, run silently:

```bash
node update-system.mjs check
```

Parse the JSON output:
- `{"status": "update-available", ...}` → offer to run `node update-system.mjs apply` (user data is never touched)
- `{"status": "up-to-date"}` / `{"status": "dismissed"}` / `{"status": "offline"}` / `{"status": "no-remote-version"}` → say nothing

The user can say "check for updates" or "update career-ops" anytime. Rollback: `node update-system.mjs rollback`

Updates pull from the public release remote (`SaadNiaziDev/career-ops-public`), not upstream santifer.

## What is career-ops

Local-first job search automation: pipeline tracking, offer evaluation, CV/PDF generation, portal scanning, batch processing.

| Surface | Role |
|---------|------|
| **Web UI** (`web/`) | Primary dashboard — Today, Explore, Pipeline, Apply, Analytics, CV, Config |
| **Claude Code** | Interactive agent + headless workers (`claude -p "..."`) |
| **Codex** | Headless workers (`codex exec "..."`) — see `CODEX.md` / `docs/CODEX.md` |
| **Cursor** | Interactive IDE (`.cursor/skills/career-ops/`) + headless workers (`agent -p --force "..."` / `cursor-agent`) |

### Codex invocation

- **Interactive Codex:** run `codex` in the repo root. Slash commands are not guaranteed; ask Codex to run the mode by name if `/career-ops` is unavailable.
- **Headless Codex:** `codex exec "prompt"`
- **Examples:** `Run career-ops scan mode`, `Run career-ops pipeline mode for data/pipeline.md`, `Evaluate this JD with career-ops auto-pipeline: https://company.com/jobs/123`

### Main Files

| File | Function |
|------|----------|
| `data/applications.md` | Application tracker |
| `data/pipeline.md` | Inbox of pending URLs |
| `data/scan-history.tsv` | Scanner dedup history |
| `portals.yml` | Query and company config |
| `templates/cv-template.html` | HTML template for CVs |
| `generate-pdf.mjs` | Playwright: HTML to PDF |
| `scan.mjs` | Zero-token portal scanner |
| `merge-tracker.mjs` | Merge batch tracker additions |
| `set-status.mjs` | Canonical tracker status updates |
| `verify-pipeline.mjs` | Pipeline health check |
| `reports/` | Evaluation reports |

Full script inventory: see `README.md` and `package.json` scripts.

### First Run — Onboarding (IMPORTANT)

Before anything else:

```bash
node doctor.mjs --json
```

Output: `{"onboardingNeeded": <bool>, "missing": [...], "warnings": [...], "autoCopied": [...]}`

If `onboardingNeeded` is true (`cv.md`, `config/profile.yml`, `modes/_profile.md`, or `portals.yml` missing), guide setup step by step. Do not evaluate or scan until basics exist.

#### Step 1: CV
Create `cv.md` from paste, LinkedIn URL, or conversation.

#### Step 2: Profile
Copy `config/profile.example.yml` → `config/profile.yml`. Fill identity, targets, comp range, `spend_tier` (`economy` / `standard` / `premium`).

#### Step 3: Portals
Copy `templates/portals.example.yml` → `portals.yml`. Tune `title_filter.positive` for target roles.

#### Step 4: Tracker
Create `data/applications.md` with the standard table header if missing.

#### Step 5: Context
Ask for superpower, deal-breakers, best achievement, proof points. Store in `modes/_profile.md`, `config/profile.yml`, or `article-digest.md`.

#### Step 6: Ready
Confirm the user can:
- Open the web UI: `npm run web:dev` → http://localhost:3000
- Paste a job URL in chat for `auto-pipeline`
- Use `/career-ops` or equivalent in Claude Code / Codex

After every evaluation, learn from feedback into user-layer files — never into `modes/_shared.md`.

### Personalization

Edit user-layer files when the user asks to change archetypes, portals, scoring weights (`modes/_profile.md`), CV template (`templates/cv-template.html`), or house rules (`modes/_custom.md`).

### Output Language

`config/profile.yml` may set:

```yaml
language:
  output: en
  modes_dir: modes/de
```

- `language.output` — human-facing prose (reports, PDFs, cover letters, etc.). Default: `en`.
- `language.modes_dir` — optional market vocabulary (e.g. DACH terms). Example: `language.modes_dir: modes/de`. This fork ships **English modes only** in `modes/`; set `modes_dir` only if you add market packs yourself.

**Agent rule:** After loading mode instructions, inject:

> Write all human-facing output in `{language.output}` regardless of the language of these instructions or the job description.

If the user asks for French output, set `language.output` to `fr`.
Market vocabulary (`language.modes_dir`) is a separate choice — change it only when the user explicitly wants a different market pack, not when they only want a different prose language.

### Skill Modes

| If the user... | Mode |
|----------------|------|
| Pastes JD or URL | auto-pipeline (evaluate + report + PDF + tracker) |
| Asks to evaluate offer | `oferta` |
| Asks to compare offers | `ofertas` |
| Wants LinkedIn outreach | `contacto` |
| Wants a formal application email | `email` — draft only; never sends |
| Asks for company research | `deep` |
| Preps for interview | `interview-prep` |
| Wants generate CV/PDF | `pdf` |
| Fills out application form | `apply` |
| Searches for new offers (free ATS scan) | `scan` |
| AI web search from natural language (Explore → AI search) | `discover` |
| Processes pending URLs | `pipeline` |
| Batch processes offers | `batch` |
| Rejection patterns / targeting | `patterns` |
| Offer/contract before signing | `offer-prep` |
| Wants to broaden the search with adjacent job titles suggested from the CV | `titles` |
| Skill-gap analysis | `upskill` |
| Follow-ups | `followup` |
| Application replies | `reply-watch` |
| System update | `update` |
| Session inbox | `agent-inbox` |

Mode files live in `modes/`. The web UI triggers the same modes via configured CLI workers.

### CV Source of Truth

- `cv.md` is canonical
- `article-digest.md` — optional proof points
- **NEVER hardcode metrics** — read from files at evaluation time

---

## Ethical Use — CRITICAL

Quality over quantity. Never submit without user review. Strongly discourage applications below 4.0/5 unless the user overrides with a specific reason.

---

## Offer Verification — MANDATORY

**NEVER trust WebSearch/WebFetch alone for posting liveness.** Use Playwright: navigate → snapshot → confirm title + description + Apply = active.

**Batch/headless exception:** mark `**Verification:** unconfirmed (batch mode)` when Playwright is unavailable.

---

## Headless / Batch Mode

| CLI | Command |
|-----|---------|
| Claude Code | `claude -p "prompt"` |
| Codex | `codex exec "prompt"` |
| Cursor | `agent -p --force "prompt"` (or `cursor-agent`) |

**Parallel fan-outs:** reserve report numbers first: `node reserve-report-num.mjs --count N`. Never let parallel workers compute `max+1` themselves.

---

## Stack and Conventions

- Node.js (`.mjs`), Playwright, YAML, HTML/CSS templates, Markdown data
- Output: `output/` (gitignored), reports: `reports/`
- After batch evaluations: `node merge-tracker.mjs`
- **NEVER add tracker rows by hand** — write TSV to `batch/tracker-additions/`

### TSV Format for Tracker Additions

One line per evaluation in `batch/tracker-additions/{num}-{company-slug}.tsv`:

```
{num}\t{date}\t{company}\t{role}\t{status}\t{score}/5\t{pdf_emoji}\t[{num}](reports/{num}-{slug}-{date}.md)\t{note}
```

Column order: status BEFORE score (merge script swaps for `applications.md`).

### Pipeline Integrity

1. **ADD** tracker rows via TSV + `merge-tracker.mjs` only
2. **UPDATE** status via `node set-status.mjs <report#|company> <State> [--note]`
3. Reports must include `**URL:**` and `**Legitimacy:** {tier}`
4. Health: `node verify-pipeline.mjs`

### Canonical States (applications.md)

Source: `templates/states.yml`

| State | When to use |
|-------|-------------|
| `Evaluated` | Report done, pending decision |
| `Applied` | Application sent |
| `Responded` | Company responded |
| `Interview` | In interview process |
| `Offer` | Offer received |
| `Rejected` | Rejected by company |
| `Discarded` | Discarded by candidate or closed |
| `SKIP` | Don't apply |

No bold, dates, or extra text in the status field — use notes.
