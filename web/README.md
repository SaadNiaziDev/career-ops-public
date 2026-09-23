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

Background workers (evaluate, PDF, research) run through **Claude Code**, **Codex**, or **Cursor Agent CLI** — pick one in **Config**. Interactive Cursor also loads the same skill via `.cursor/skills/career-ops/`.

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
- Request bodies are capped before parsing; CV uploads are limited to 5 MB, worker requests to 250 KB, and CV text to 200 KB.
- Every AI worker launch shares a server-side queue: 3 active globally, 2 outstanding per authenticated session, and 12 queued by default. Excess requests receive HTTP 429 with a retry hint.
- Set `CAREER_OPS_WORKER_GLOBAL_LIMIT`, `CAREER_OPS_WORKER_CLIENT_LIMIT`, or `CAREER_OPS_WORKER_QUEUE_LIMIT` before launching the server to change those limits (maximums: 32, 16, and 128).

## Development

```bash
npm run web:typecheck
npm run web:build
```
