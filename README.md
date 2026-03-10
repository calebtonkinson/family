# Home Management

Home Management is a Turborepo monorepo for a household management app with a Next.js frontend, a Hono + DBOS backend, shared Drizzle database code, and AI tooling for chat, recipes, and deep research.

## Services

| Service | Port | Package | Command |
| --- | --- | --- | --- |
| Frontend | 3000 | `@home/web` | `PORT=3000 yarn workspace @home/web dev` |
| Backend | 3001 | `@home/server` | `yarn workspace @home/server dev` |

## Workspace Layout

- `apps/web`: Next.js 15 PWA and authenticated client UI.
- `apps/server`: Hono API, DBOS workflows, and AI execution entrypoints.
- `packages/db`: Drizzle schema, client, migrations, and seed helpers.
- `packages/shared`: shared Zod schemas, types, and API contracts.
- `packages/ai`: prompt builders, tool definitions, and research helpers.
- `tooling`: shared config and repository guardrail scripts.

## Local Development

1. Use Node 20 and Yarn 4.
2. Install dependencies with `yarn install`.
3. Start the backend first: `yarn workspace @home/server dev`.
4. Start the frontend with an explicit port: `PORT=3000 yarn workspace @home/web dev`.

## Quality Commands

- `yarn lint`
- `yarn typecheck`
- `yarn build`
- `yarn test`
- `yarn check:repo`

## Repository Map

The repository source of truth lives in `docs/`.

- Start with `docs/README.md`.
- Current architecture and runtime contracts are documented in `docs/architecture/`.
- Quality rules and smoke coverage live in `docs/quality/`.
- Historical product and design notes remain at the repo root and are indexed from `docs/README.md`.
