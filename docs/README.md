# Docs Index

This directory is the repository-local knowledge base for the Home Management app. Keep current-state facts here and treat root-level planning notes as supplemental context.

## Canonical Docs

- `architecture/current-state.md`: high-level system structure and major code paths.
- `architecture/runtime-and-env.md`: local runtime, service startup, and environment variable contracts.
- `design/visual-principles.md`: current UI direction and visual design rules.
- `quality/invariants.md`: repository rules that should stay mechanically true.
- `quality/manual-smoke.md`: stable manual verification flows.

## Root-Level Reference Notes

These files remain useful, but should not become the only source of truth for current behavior.

- `design.md`: original system design and architecture notes.
- `application.md`: UX and product behavior notes.
- `deep-research-feature-plan.md`: execution plan for the deep research feature.
- `recipes-meal-planning.md`: recipe and meal-planning concept document.
- `ux-review-chat.md`: chat-specific review notes.
- `ux-review-tasks.md`: task UX review notes.
- `ideas.md`: loose product ideas and backlog fragments.

## Documentation Rules

- Prefer updating these docs when changing architecture, runtime setup, or repository rules.
- Keep docs factual and close to the code as it exists now.
- When a root-level note becomes operationally important, summarize the lasting rule in `docs/` and link back to the note for detail.
