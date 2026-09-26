# Public search source rules

Explore AI search follows `modes/discover.md` and emits the same `<<offer:{...}>>` record whether invoked in the web UI or through the configured CLI.

- Employer career pages and public ATS pages: prefer direct job details. Apply the liveness API/browser check before displaying or evaluating a vacancy.
- Publicly indexed company, recruiter, and hiring announcements: ordinary search only. Never scrape LinkedIn, sign in, or automate authenticated browsing. Keep these as low-confidence `hiring-signal` leads with a public permalink; the UI never offers vacancy evaluation for them.
- General job boards and public discussion pages: emit only when the page is a specific public role or clearly announces hiring. Mark source and confidence; do not infer an opening from generic recruiting language.
- Each source is an independent web-search query. An unavailable source does not invalidate other results. Preserve candidates when verification is uncertain, label them, and require an explicit user confirmation before evaluation.
- Record the discovery timestamp in the UI. Set `postedAt` only from an explicit date; otherwise keep it blank and retain a non-specific `postedHint` only when the source provides one.
