# career-ops web

Local-first web UI for career-ops. It reads and writes the same files as the core engine (`cv.md`, `config/`, `data/`, `reports/`, `output/`) — no cloud database, no duplicate tracker.

## Quick start

Requires Node 20+.

```bash
# From repo root (first time)
npm install
npm run web:install

# Launch the UI
npm run web:dev
```

Open http://localhost:3000.

Point at another checkout with `CAREER_OPS_ROOT=/path/to/career-ops` in `web/.env.local`.

## Agents

Background workers (evaluate, PDF, research) run through **Claude Code** or **Codex** — pick one in **Config**. Use **Cursor** in the repo for day-to-day editing; it loads the same skill via `.cursor/skills/career-ops/`.

## Features

- **Today** — follow-ups, fresh matches, roles awaiting a decision
- **Add job** — paste a URL; evaluate, add to inbox, or AI-search similar roles
- **Explore** — free reverse-ATS scan; optional AI hunt (requires configured CLI)
- **Pipeline** — inbox triage, tracker, reports, status updates
- **Outreach** — contacts ledger + cover/email/contact drafts per role
- **Apply kit** — tailored CV (PDF), cover letter, recruiter email, find contacts (one-click on each report)
- **Apply** — assisted form prefill; never auto-submits
- **Analytics / CV / Portals / Config**

## Safety

- Runs entirely on your machine
- Never submits applications for you
- Your CV and tracker stay in local files under the repo root

## Development

```bash
npm run web:typecheck
npm run web:build
```
