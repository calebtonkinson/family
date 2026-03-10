# Repository Invariants

These are the repository-level rules the harness should keep true.

## Architecture

- Apps may import shared code from `packages/*`, but should not import code from another app directly.
- Backend route modules belong in `apps/server/src/routes` and must be mounted by the server app.
- Database schema modules belong in `packages/db/src/schema` and must be re-exported from `packages/db/src/schema/index.ts`.

## Runtime And Contracts

- Every protected backend route must remain household-scoped through the auth context and route logic.
- Environment variables used in application code must be documented in `docs/architecture/runtime-and-env.md` and represented in the relevant example env file.
- The frontend build cannot be the only place lint failures are detected, because `apps/web/next.config.ts` disables lint during `next build`.

## Testing And Changes

- Repository changes should keep `lint`, `typecheck`, `build`, and `test` green from the root.
- New runtime seams should be importable in tests without forcing full process startup when practical.
- When architecture or runtime behavior changes, update the docs in `docs/` in the same change.
