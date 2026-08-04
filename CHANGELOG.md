# Changelog

All notable changes to this fork are documented here. Versioning restarts at `0.1.0` for this public release — see [README.md](README.md) for why.

## [0.1.0](https://github.com/SaadNiaziDev/career-ops-public/releases/tag/v0.1.0) — 2026-08-04

First standalone public release of this fork.

### Added
- **Web dashboard redesign** — full Material Design 3 UI overhaul across the app (Today, Explore, Pipeline, Apply, Analytics, CV, Config, Portals). New shared MD3 component set (`Md3Card`, `Md3ActionButton`, `Md3Input`, `Md3Select`, `Md3Segmented`, `Md3Collapse`, `Md3Empty`, navigation rail, material-symbol icons) replacing the previous Ant Design dependency.
- **"Add a company" on the Portals page** — a form to add a tracked company straight into `portals.yml` (`tracked_companies`) from the UI, instead of hand-editing YAML. Auto-detects zero-token ATS providers (Greenhouse/Lever/Breezy) when you supply an alternate ATS URL.
- **Pakistan tech market base list** — `templates/portals.example.yml` now ships a curated set of Karachi/Lahore/Islamabad software houses, fintechs, and product companies as an opt-in base for anyone targeting that market.

### Fixed
- `test-all.mjs`'s absolute-path guard no longer false-positives on `verify-public-release.mjs`'s own detection code.
- Removed a stray design-tool export (`Material Design 3 Migration.zip`) that had been committed to the repo; added `*.zip` / `design_handoff_*/` to `.gitignore` so design handoff dumps can't slip back in.

### Changed
- Versioning for this fork now starts fresh at `0.1.0` (root package) / `0.4.0` (web package), decoupled from upstream `santifer/career-ops` version numbers, to avoid implying parity with a specific upstream release.

---

Full history prior to this fork's public release lives in upstream [santifer/career-ops](https://github.com/santifer/career-ops).
