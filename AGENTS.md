# AGENTS.md

## Repository Map

Start here, then follow the docs:

- `README.md`: repo overview, commands, and workspace layout.
- `docs/README.md`: canonical docs index.
- `docs/architecture/current-state.md`: current runtime structure and major code paths.
- `docs/architecture/runtime-and-env.md`: startup and env contracts.
- `docs/quality/invariants.md`: repository-level rules and guardrails.
- `docs/quality/manual-smoke.md`: stable manual verification checklist.

## Overview

This is a Turborepo monorepo for a household management app.

| Service | Port | Package | Command |
| --- | --- | --- | --- |
| Frontend | 3000 | `@home/web` | `PORT=3000 yarn workspace @home/web dev` |
| Backend | 3001 | `@home/server` | `yarn workspace @home/server dev` |

Shared packages:

- `@home/db`: Drizzle schema, client, migrations, and seed helpers.
- `@home/shared`: shared Zod contracts and API types.
- `@home/ai`: prompts, tool definitions, and research helpers.

## Development Notes

- Use Node 20 and Yarn 4.
- The backend dev script already handles the package build order: `@home/db` -> `@home/shared` -> `@home/ai` -> `@home/server`.
- `apps/server/.env` sets `PORT=3001`, so always start the frontend with `PORT=3000` in reused shells.
- Local dev credentials login needs `DEV_LOGIN_ENABLED` and `DEV_LOGIN_PASSWORD` in `apps/web/.env`, not only `apps/server/.env`, because the NextAuth credentials check runs in the web app process.
- `packages/db/src/client.ts` can route Neon requests through `NEON_LOCAL_PROXY` when set.
- After changes to auth or the login flow, clear `apps/web/.next` and restart the frontend dev server to avoid stale server-action hashes.

## UI / Design Process Notes

- When reviewing or changing aesthetics, use browser screenshots on both desktop and mobile before deciding on direction.
- Prefer system-level visual changes first: tokens, shell, navigation, buttons, cards, and empty states before page-by-page ornament.
- Current visual direction is warm-neutral with a single blue accent family. Avoid mixing orange-to-blue decorative gradients across shells or major surfaces.
- The dashboard home page should stay flatter than inner pages. Avoid double-layered framed cards where the page already sits inside a strong surface.
- For this app, “better aesthetics” usually means stronger hierarchy and less empty dead space, not more decorative layers.

## Quality Commands

- `yarn lint`
- `yarn typecheck`
- `yarn build`
- `yarn test`
- `yarn check:repo`

## Dev Login

The local credentials login is controlled by:

- `DEV_LOGIN_ENABLED`
- `DEV_LOGIN_PASSWORD`

When enabled, `/login` renders a dev login form below Google sign-in. Any email works, and first-time sign-in creates the required household, family member, and user records. The backend receives the same session/token shape as the Google OAuth path.
