# career-ops

A simple, local job-search app. One click to find jobs, one click to evaluate them against your CV, then apply or email the right person, and track everything.

- **Search** — free scan of company job boards and remote boards, plus AI web search (public LinkedIn, Reddit and X posts too).
- **Apply** — evaluation summary, tailored CV (PDF), cover letter, form answers, and the hiring contact with an email, a LinkedIn connection note (under 300 characters) and a follow-up message.
- **Track** — every application, what you sent, and which follow-ups are due.
- **Brain** — your profile, CV, proof of work and writing voice. Every AI task reads from here.
- **Settings** — AI engine (Claude Code or Codex), what to search for, companies to watch, data export.

Nothing is ever sent or submitted for you.

## Requirements

- Node.js 22+
- [Claude Code](https://claude.ai/code) or [Codex](https://github.com/openai/codex), signed in with your subscription

## Start

```bash
npm install
npm run dev
```

Open http://localhost:3000, drop in your CV, and click **Scan job boards**.

Your data stays in this folder (`cv.md`, `config/`, `portals.yml`, `data/career-ops.db`) and is never committed.

## License

MIT
