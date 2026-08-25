# career-ops

Local-first AI job search automation — a web dashboard plus Claude Code, Codex, and Cursor agents. Scan job portals, evaluate listings against a structured A–F rubric, tailor your CV, and track applications, all running on your own machine.

> **Fork notice.** This is a UI-first fork of [santifer/career-ops](https://github.com/santifer/career-ops) by [Santiago Fernández de Valderrama](https://santifer.io) — all credit for the original agent pipeline, scoring rubric, and provider architecture goes to the upstream project. This fork (maintained by [Saad Ali Khan](https://github.com/SaadNiaziDev)) adds a local web dashboard, a Material Design 3 UI, and a Pakistan-market portal base list, and re-releases it publicly at [SaadNiaziDev/career-ops-public](https://github.com/SaadNiaziDev/career-ops-public). Licensed MIT — see [LICENSE](LICENSE).

## Quick start

```bash
git clone https://github.com/SaadNiaziDev/career-ops-public.git career-ops
cd career-ops
npm install
npm run web:install
npx playwright install chromium
npm run web:dev
```

Open http://localhost:3000. On first run the home screen asks for your CV:

- **Drop a PDF** of your résumé — text is extracted locally (scanned-image PDFs need a paste instead)
- **Drop a `.md` / `.txt` file** — saved as `cv.md` after you review it
- **Paste** the CV text

You review the markdown before anything is written. An AI CLI (Claude Code, Codex, or Cursor) is optional: it only polishes formatting. Paste and `.md` work with no CLI.

Or set it up by hand:

1. Copy `templates/portals.example.yml` → `portals.yml` (or run `node doctor.mjs --json`, which copies it for you)
2. Copy `config/profile.example.yml` → `config/profile.yml`
3. Copy `modes/_profile.template.md` → `modes/_profile.md` (also auto-copied by doctor)
4. Create `cv.md` from your résumé (see below)
5. Create `data/applications.md` from the template header if missing

```bash
node doctor.mjs --json        # onboarding/health check
node verify-pipeline.mjs      # tracker integrity check
```

Full walkthrough: [docs/SETUP.md](docs/SETUP.md). Codex users: [docs/CODEX.md](docs/CODEX.md).

## How to get `cv.md` (and the other markdown files)

career-ops generates every user-facing draft from a small set of **local markdown/yaml files**. You do not need all of them on day one. `cv.md` is the only one required to start matching jobs.

### Required — `cv.md`

This is your résumé in markdown. Ways to create it:

| Method | What to do |
|---|---|
| **Web UI (recommended)** | `npm run web:dev` → drop a PDF or `.md` on the welcome screen → review → save |
| **Export from Word / Google Docs** | File → Download → Plain Text (`.txt`) or Markdown, save as `cv.md` in the repo root |
| **LinkedIn** | Profile → More → Save to PDF, then drop that PDF on the welcome screen |
| **By hand** | Copy `examples/cv-example.md` to `cv.md` and **replace** the fictional Alex Chen content. Keep the headings. |

Use these headings so scoring, PDF export, and the studio preview all parse the same way:

- `# CV -- {Your Name}` then `**Location:**` / `**Email:**` / `**LinkedIn:**` lines
- `## Professional Summary`
- `## Work Experience` — each role as `### Company -- Location`, then `**Title**`, then dates, then bullets
- `## Projects` / `## Education` / `## Skills`

The fictional file `examples/cv-example.md` is a **structure** reference, not sample content to submit.

### Optional markdown that improves drafts

| File | Copy from | What to put in it |
|---|---|---|
| `article-digest.md` | `examples/article-digest-example.md` | Proof points and hero metrics per project (evaluations and cover letters read this) |
| `writing-samples/*.md` | [writing-samples/README.md](writing-samples/README.md) | Emails, posts, anything that sounds like you — used for voice, not facts |
| `modes/_profile.md` | auto-created from `modes/_profile.template.md` | Target archetypes and narrative |
| `modes/_custom.md` | auto-created from `modes/_custom.template.md` | House rules and output preferences (never facts) |
| `interview-prep/story-bank.md` | create when you prep | STAR stories for interviews |
| `voice-dna.md` | `examples/voice-dna.example.md` | Voice/style only |

`node doctor.mjs --json` copies the `_profile.md`, `_custom.md`, and `portals.yml` starters when they are missing. It never copies `cv.md` or `config/profile.yml` (those are your identity).

## Agent workflows

Paste a job URL into the web chat for **auto-pipeline**, or invoke modes from your CLI:

```bash
claude -p "Evaluate this JD with career-ops auto-pipeline: https://company.com/jobs/123"
codex exec "Run career-ops scan mode in this repo."
agent -p --force "Run career-ops scan mode in this repo."
```

See `modes/` for every mode and [AGENTS.md](AGENTS.md) for how agents route between them.

**Codex note:** slash commands are not guaranteed in Codex — use plain-language prompts (e.g. `Run career-ops scan mode`) or `codex exec` for one-shot workers. See [CODEX.md](CODEX.md) and [docs/CODEX.md](docs/CODEX.md).

## Tweak it to your own job search

Everything that shapes *your* results lives in a small set of files the system never overwrites (the "user layer" — see [DATA_CONTRACT.md](DATA_CONTRACT.md)). Edit these directly, or ask your agent to edit them for you ("update my archetypes", "add this company to my portal scan").

| Want to change... | Edit this |
|---|---|
| Target roles, comp band, location policy, spend tier | `config/profile.yml` |
| Archetypes, narrative, negotiation scripts, proof points | `modes/_profile.md` |
| House rules, output preferences, custom workflows | `modes/_custom.md` |
| Your résumé (single source of truth for all generated content) | `cv.md` |
| Extra proof points / achievements for CVs and cover letters | `article-digest.md` |
| CV PDF layout | `templates/cv-template.html` |
| Which companies/portals get scanned | `portals.yml` (see below) |
| Output language (cover letters, reports, etc.) | `config/profile.yml` → `language.output` |

### Customizing the portal scanner

`portals.yml` controls what `scan` mode watches: `tracked_companies` (specific employers), `search_queries` (broad `site:` searches), `title_filter` (role keyword match), and `location_filter` (geography gate — applied in code, not just as an agent instruction).

**Add a company:**
- **From the web UI** — Portals page → **Add a company**. Fill in the name, official careers URL, and (optionally) an alternate ATS URL if you know it's Greenhouse/Lever/Breezy — the scanner then reads it directly at zero token cost. This writes straight into `portals.yml`.
- **By hand** — add an entry under `tracked_companies:` in `portals.yml`:
  ```yaml
  - name: Example Co
    careers_url: https://example.com/careers
    api: https://boards-api.greenhouse.io/v1/boards/example/jobs   # optional, if known
    notes: "Why you're tracking them"
    enabled: true
  ```

**Base company lists:** `templates/portals.example.yml` ships with curated starter lists — a global AI/ML/dev-tools set and a dedicated **Pakistan tech market** section (Karachi/Lahore/Islamabad software houses, fintech, and product companies). `portals.yml` is your own copy — prune it to just the region/companies you care about, or add more. Nothing you add there is ever touched by `node update-system.mjs apply`.

**Scope results to a region:** set `location_filter` — `always_allow`/`allow`/`block` on location strings, e.g.:
```yaml
location_filter:
  always_allow: ["Pakistan", "Karachi", "Lahore", "Islamabad"]
  allow: ["Remote"]
  block: ["India", "United Arab Emirates"]
```
This is enforced in `scan.mjs` itself (hard filter, not best-effort). The web UI's free-text **Explore → AI search** is a separate, LLM-driven path — it's *instructed* to respect the same filter but isn't code-enforced the same way, so keep your search phrasing specific if you use it.

### Everything else

Full customization reference: [AGENTS.md](AGENTS.md) (mode routing, skill list) and [DATA_CONTRACT.md](DATA_CONTRACT.md) (which files are yours vs. system-managed).

## Staying up to date

```
node update-system.mjs check    # pulls from this fork's release remote, never touches your data
node update-system.mjs apply
node update-system.mjs rollback
```

## Credits & license

Built on [santifer/career-ops](https://github.com/santifer/career-ops) — the agent pipeline, evaluation rubric, and ATS provider layer originate there. This fork's own contributions (web dashboard, MD3 design system, portal add-company UI, Pakistan market base list) are maintained by [Saad Ali Khan](https://github.com/SaadNiaziDev).

MIT License — see [LICENSE](LICENSE). Original copyright © 2026 Santiago Fernández de Valderrama.
