# career-ops

Local-first AI job search automation — web dashboard plus Claude Code, Codex, and Cursor agents.

Based on [career-ops](https://github.com/santifer/career-ops) by [santifer](https://santifer.io). Maintained by Saad Ali Khan as a UI-first fork with a public release at [SaadNiaziDev/career-ops-public](https://github.com/SaadNiaziDev/career-ops-public).

**Start:** `npm run web:dev` → http://localhost:3000

**Modes:** `claude -p "Run career-ops [mode]"`, `codex exec "Run career-ops [mode]"`, or `agent -p --force "Run career-ops [mode]"`

Example modes: `auto-pipeline` (evaluate URL), `scan` (portal scrape), `oferta` (offer eval), `pdf` (generate CV), `interview-prep`.

See `modes/` for all available modes, `AGENTS.md` for agent workflows, and `docs/SETUP.md` for first-run setup.

**Codex:** slash commands are not guaranteed — use plain-language prompts or `codex exec`. See `CODEX.md` and `docs/CODEX.md`.

Personal data stays local: `cv.md`, `config/profile.yml`, `portals.yml`, `data/`, `reports/`. See `DATA_CONTRACT.md`.
