# Career-Ops Improvement Plan

Product analysis date: 2026-08-09. Source: system audit (reports UI, scan/discover, CV gen, contacts).

**Thesis:** Rich structured data already generated (Machine Summary YAML, 57-provider scan, 12-col contacts TSV) but thrown away at render time. Biggest wins are rendering + ranking work, not new data collection.

---

## Phase 1 — Report Verdict Card + Dimension Visuals (Low effort / High impact)

**Problem:** `report-view.tsx` renders raw markdown; `format.ts parseReport()` extracts only header fields. Machine Summary YAML (decision, hard_stops, top_strengths, soft_gaps, risk_summary, legitimacy) unused by UI.

**Work:**
1. `web/src/lib/format.ts` — add `parseMachineSummary(md)`: extract YAML block under `## Machine Summary`, parse to typed object. Tolerant of missing keys (older reports).
2. New `web/src/components/report/verdict-card.tsx` — top-of-report card:
   - Decision chip (Apply / Consider / Research first / Skip)
   - Score dial + legitimacy badge + risk level
   - `hard_stops[]` red chips, `soft_gaps[]` amber, `top_strengths[]` green
3. New `web/src/components/report/dimension-chart.tsx` — bar/radar for 6 dimensions (Match, North Star, Comp, Culture, Red flags, Global). Render only when structured scores present (see Phase 4); fall back to global score alone.
4. `report-view.tsx` — mount verdict card above markdown; A–G blocks as tabbed or stepper sections instead of one scroll wall. Hide raw Machine Summary block from prose view (now rendered natively).

**Acceptance:** open any evaluated report → 5-second scan tells decision, why, and risks without reading prose. Old reports without YAML degrade gracefully to current view.

---

## Phase 2 — Fit-Score Ranking in Scan Results (Low / High)

**Problem:** Results render in insertion order (`results-list.tsx`). No relevance weighting; `matchedKeyword` captured but unused.

**Work:**
1. `scan.mjs` — compute heuristic `fitScore` 0–100 per offer at scan time (zero AI tokens):
   - CV keyword overlap (tokenize `cv.md` skills/titles once per run)
   - Title match strength (exact positive-keyword hit > fuzzy)
   - Comp band fit vs `config/profile.yml`
   - Freshness decay (posting age)
   - Trust flags subtract
2. Emit `fitScore` in offer JSON envelope + `formatPipelineOffer()` metadata.
3. `web/src/lib/core/scan.ts` — carry field through `ScanEvent`.
4. `results-list.tsx` — default sort by fitScore desc; sort toggle (fit / date / company); score badge on `discovery-card.tsx`.
5. Weights readable from `portals.yml` `ranking:` block (optional, sane defaults).

**Acceptance:** scan run shows best-fit offers first; badge explains score; sort toggle works; no new tokens consumed.

---

## Phase 3 — Contacts Grouping + Facets + Outreach Status (Low / Med)

**Problem:** `contacts-view.tsx` is flat search + paginate. TSV already has `channel`, `verified`, `source`, `trackerNum` — unused for navigation. No outreach state.

**Work:**
1. `contacts-view.tsx` — group-by-company collapsible sections (default view); flat list toggle stays.
2. Facet chips: channel, verified, contact type. Reuse `web/src/components/inbox/facet-chips.tsx` pattern.
3. Schema: append two TSV columns — `contact_type` (recruiter/hiring-manager/peer/interviewer; contacto mode already classifies, persist it) and `outreach_status` (not-contacted/messaged/replied/ghosted) + `last_touch` date. Update `web/src/lib/contacts.ts` `ContactRow`, `readContacts()` (tolerate old 12-col rows), `appendContact()`.
4. `web/src/app/api/contacts/route.ts` — PATCH endpoint for status updates; status dropdown per row in UI.
5. Dedup on append: same email or linkedin URL → update row, don't duplicate.
6. `modes/contacto.md` + `modes/followup.md` — write `contact_type` on save; followup mode reads `outreach_status`/`last_touch` to propose nudges.

**Acceptance:** contacts page answers "who do I know at X, what channel, did they reply" without search; followup mode consumes status.

---

## Phase 4 — Structured Per-Dimension Scores + User Weights (Med / Med, unlocks 1+5)

**Problem:** Dimension scores live in prose only. Global score fixed formula; users can't express comp-first vs culture-first priorities.

**Work:**
1. `modes/oferta.md` + `batch/batch-prompt.md` — require Machine Summary key:
   ```yaml
   scores: {match: 4.2, north_star: 4.0, comp: 3.5, culture: 3.0, red_flags: -0.2, global: 3.9}
   ```
2. `config/profile.yml` — optional `scoring.weights:` map; modes compute global as weighted average when present. Document culture-cap rule still applies (cap logic in `modes/_shared.md` unchanged).
3. Phase 1 `dimension-chart.tsx` consumes real numbers.
4. `web/src/app/analytics` — dimension trends over time (avg comp score drifting down = market signal).

**Acceptance:** new reports carry `scores:` map; changing weights in profile.yml changes global on next evaluation; analytics plots dimensions.

---

## Phase 5 — CV Style Tokens + Template Picker UI (Med / High)

**Problem:** `cv-templates.mjs` resolver + `cv.template` config exist, but no UI; customizing look requires hand-writing full HTML template.

**Work:**
1. `config/profile.yml` `cv.style:` block — `accent_color`, `heading_color`, `font_stack`, `margin`, `density`. `build-cv-html.mjs` injects as CSS vars; `templates/cv-template.html` reads vars with current values as fallbacks.
2. Ship 3 more built-in templates: `cv-template.modern.html`, `cv-template.compact.html`, `cv-template.academic.html` (respect same {{PLACEHOLDER}} contract + ATS text normalization).
3. CV page (`web/src/app/cv`) — settings rail: template picker (thumbnail per template), style token controls (color picker, density), writes to profile.yml via API.
4. Preview: render selected template with current cv.md via `build-cv-html.mjs` in iframe (HTML preview, no PDF round-trip).

**Acceptance:** user switches template + accent color from UI, next `pdf` mode run uses them; no template file editing needed.

---

## Phase 6 — Outcome Feedback Loop → Ranking (Med / High, moat feature)

**Problem:** Application outcomes (Rejected/Interview/Offer in `applications.md`) never influence future scan ranking or evaluation. `patterns` mode analyzes but output is prose only.

**Work:**
1. New `patterns-signals.mjs` (or extend patterns mode) — distill tracker outcomes into machine-readable `data/ranking-signals.yml`: company-size/ATS-provider/archetype/comp-band response rates.
2. `scan.mjs` fitScore (Phase 2) consumes signals as multipliers (bounded, e.g. ±15%, so filters stay primary).
3. Explore UI — "why ranked here" tooltip includes signal contributions ("interviews from Ashby startups: +8").
4. Surface learning in UI: "23 evaluations → system learned X" card on analytics page. Retention lever: visible compounding.

**Acceptance:** after ≥10 tracked outcomes, scan ordering measurably shifts toward responding segments; tooltip explains why; signals regenerate via single command.

---

## Sequencing

```
Phase 1 ─┬─ Phase 4 ─── Phase 6
Phase 2 ─┘      (2 feeds 6)
Phase 3  (independent)
Phase 5  (independent)
```

Ship 1+2 first — pure render/sort on existing data, transforms perceived quality. 3 and 5 parallelizable. 4 before 6.

## Data-contract notes

- All schema additions backward-tolerant (old reports/TSV rows must parse).
- User-tunable knobs (`scoring.weights`, `cv.style`, `ranking:`) live in user layer (`config/profile.yml`, `portals.yml`) per DATA_CONTRACT.md.
- Mode file changes (`oferta.md`, `batch-prompt.md`, `contacto.md`, `followup.md`) are system layer — keep user personalization out.
