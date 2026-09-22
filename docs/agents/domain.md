# Domain Docs

How engineering skills consume this repository's domain documentation.

## Before exploring

- Read `CONTEXT.md` at the repository root when it exists.
- Read relevant decisions under `docs/adr/` when they exist.
- If either is absent, proceed silently. Domain-modeling skills create them when real terms or decisions emerge.

## Layout

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── web/ and root CLI modules
```

## Vocabulary

Use terms as defined in `CONTEXT.md`. Do not drift to synonyms the glossary rejects. If a needed concept is absent, reconsider the term or note a genuine domain-model gap.

## Architecture decisions

If proposed work contradicts an ADR, surface the conflict explicitly instead of silently overriding it.
