# career-ops

A local web app for a job search: **Search → Evaluate → Apply/Email → Track**.
Everything runs on this computer. AI tasks run on the user's own Claude Code or Codex subscription.

## Run

```bash
npm install        # installs web/ and the PDF browser
npm run dev        # http://localhost:3000
npm test
```

## Layout

| Path | What |
|------|------|
| `web/src/app/` | Pages (`explore` = Search, `apply`, `pipeline` = Track, `brain`, `config` = Settings) and API routes |
| `web/src/components/` | React UI |
| `web/src/lib/agent.ts` | The only way AI runs: Claude/Codex headless, no file or shell tools, JSON answers |
| `web/src/lib/prompts.ts` | Every AI prompt (evaluate, tailor CV, cover letter, outreach + LinkedIn, search) |
| `web/src/lib/db.ts` | SQLite store `data/career-ops.db` (applications, reports, jobs, events, outreach, settings) |
| `web/src/lib/search/` | Free job-board scan (Greenhouse, Lever, Ashby, Workable, Breezy, SmartRecruiters, RemoteOK, WWR, HN) and search settings |
| `web/engine/` | CV → HTML → PDF renderer, templates and fonts |
| `web/tests/` | Node test suite |

## User data (never edit for the user unless asked; never commit)

`cv.md`, `config/profile.yml`, `portals.yml`, `modes/_profile.md`, `modes/_custom.md`, `article-digest.md`, `voice-dna.md`, `writing-samples/`, `data/`, `reports/`, `output/`.

## Rules

- **Truth:** generated CVs, letters, emails and LinkedIn messages use only facts from the user's files. Reformulate keywords, never fabricate.
- **Never send or submit** on the user's behalf. Drafts open in Gmail/LinkedIn; the user sends and confirms.
- AI output is untrusted: agents return JSON, the server validates it and does every write.
- Applying below a 4.0/5 score requires an explicit reason.

## Git Commits (CRITICAL)

- Commit messages are **one line only**: `type(scope): summary`. No body.
- **Never** add `Co-Authored-By` or any other attribution/trailer line to commits.
