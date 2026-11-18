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
Set `NEXT_PUBLIC_ISSUE_REPOSITORY=owner/repo` in `web/.env.local` to redirect bug reports and duplicate searches in a downstream fork; this fork defaults to `SaadNiaziDev/career-ops-public`.

Interview session transcripts are joined by `tracker_num` frontmatter. Preview a safe backfill of legacy session files with `npm run sessions:backfill` from `web/`; apply only unambiguous matches with `npm run sessions:backfill:apply`. The apply command creates a timestamped backup beside each changed file and leaves ambiguous or unmatched sessions untouched.

## Agents

Background workers (evaluate, PDF, research) run through **Claude Code**, **Codex**, or **Cursor Agent CLI** — pick one in **Config**. Interactive Cursor also loads the same skill via `.cursor/skills/career-ops/`.

## Workflow

- **Search** — free ATS discovery, optional AI search, and saved matches in one workspace. Add a job link from here and evaluate it before preparing an application.
- **Apply** — one workspace per role for the CV, form answers, cover letter, email, and submission record. Opening Gmail or copying a message leaves it as a draft; confirm only after sending.
- **Track** — application records with the date, submission method, URL, CV filename, exact sent messages, follow-ups, contacts, notes, and status history. Older tracker entries stay available with missing details clearly marked.
- **Tools** — Today, CV, profile, contacts, portals, analytics, and configuration.

Submission and message history is stored in immutable local JSON files under `data/application-activity/`, alongside the existing Markdown tracker. Sent outreach is also retained in `data/outreach/`. No database or additional service is required. This workflow does not automatically import an external mailbox.

Run `npm run test:flow` from `web/` for an isolated browser check of Search → Apply → Track, including sent-message confirmation and mobile layouts. It uses fictional data, intercepts the Gmail draft, and never sends email or changes your real applications.

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
