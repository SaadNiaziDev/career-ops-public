# career-ops

Personal fork. UI-first local job search automation — web dashboard + Claude Code / Codex workers.

**Start:** `npm run web:dev` → http://localhost:3000

**Modes:** `claude -p "Run career-ops [mode]"` or `codex exec "Run career-ops [mode]"`

Example modes: `auto-pipeline` (evaluate URL), `scan` (portal scrape), `oferta` (offer eval), `pdf` (generate CV), `interview-prep`.

See `modes/` for all available modes and `AGENTS.md` for agent workflows.

Personal data: `cv.md`, `config/profile.yml`, `portals.yml`, `data/`, `reports/`.
