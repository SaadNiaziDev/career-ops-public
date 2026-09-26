# Interview Sessions

Machine-readable interview transcripts, one `.md` file per round. The
`interview/debrief` and `interview/practice` modes write files here automatically
after a real or practice round. Downstream analysis modes read them; each consumer
documents its own usage.

## Format

Speaker labels — `**Interviewer:**` / `**Candidate:**` — so a consumer can read
either side without re-inferring who spoke:

```markdown
---
company: Acme Corp
role: Instructional Designer
tracker_num: 42
round: behavioral
round_no: 2
date: 2026-06-01
interviewer_role: Senior HR Partner
source: debrief
outcome: advanced
---

## Q1
**Interviewer:** Tell me about a time you...
<!-- competency: stakeholder-management -->
**Candidate:** ...answer...
```

`round`: `screen | hiring-manager | technical | system-design | behavioral | onsite | final`.
`round_no`: positive integer identifying the application round. Required for newly generated sessions.
`tracker_num`: exact application number from `data/applications.md`. Required for newly generated sessions and the primary session-to-application key.
`source`: `debrief | practice | mock | manual`.
`outcome`: `pending | advanced | rejected`. Practice and mock sessions use `pending`.

Legacy files without `tracker_num` are accepted only when their company/role metadata or filename maps to exactly one tracker application. Ambiguous and unmatched files are ignored. Preview a migration with `npm run sessions:backfill` from `web/`; applying it requires `npm run sessions:backfill:apply` and creates backups for changed files.

## Competency tags (optional)

A `<!-- competency: tag[, tag...] -->` comment on the line directly above a
`**Candidate:**` line annotates that answer's competency — lowercase-kebab-case,
comma-separated for multiple. Optional; a consumer that wants tags can infer them
when absent.

## Privacy — important

Sessions contain real interviewer names and companies. This directory is
gitignored (only this README and `.gitkeep` are tracked) — session content never
enters version control.
