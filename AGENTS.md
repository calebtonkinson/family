# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Yarn 4.6.0 (Berry) monorepo managed with Turborepo. It contains a **Home Management** app with:

- **`apps/web`** — Next.js 15 frontend (React 19, TailwindCSS 4, NextAuth with Google OAuth)
- **`apps/server`** — Hono REST API server (DBOS durable workflows, AI assistant)
- **`packages/db`** — Drizzle ORM database schema (Neon PostgreSQL / local PG)
- **`packages/ai`** — AI tools and prompts (Vercel AI SDK)
- **`packages/shared`** — Shared types and constants

### Key commands

See `package.json` scripts in each workspace. Top-level commands:

| Action | Command |
|---|---|
| Install deps | `yarn install` |
| Dev (all) | `yarn dev` (runs turbo dev for web + server) |
| Lint | `yarn lint` |
| Typecheck | `yarn typecheck` |
| Build | `yarn build` |
| Build packages only | `yarn workspace @home/shared build && yarn workspace @home/db build && yarn workspace @home/ai build` |

### Running services individually

- **Web** (port 3000): `yarn workspace @home/web dev`
- **Server** (port 3001): `yarn workspace @home/server dev`

When running both simultaneously, start the server first (port 3001), then the web app. The `yarn dev` command handles this via Turborepo.

### Database setup

The project uses `@neondatabase/serverless` for database connections. A local PostgreSQL is set up for development:

- **Connection**: `postgresql://dev:devpass@localhost:5432/home_management`
- **Start PG**: `sudo pg_ctlcluster 16 main start`
- **Push schema**: `DATABASE_URL=postgresql://dev:devpass@localhost:5432/home_management yarn workspace @home/db push`

Note: The `@neondatabase/serverless` driver uses HTTP-based connections. While `drizzle-kit push/migrate` works with local PG (uses standard `pg` driver), the application's runtime `neon()` client may not connect to a local PostgreSQL without a Neon proxy. DBOS workflows connect via standard PG and work locally.

### Environment files

- `apps/server/.env` — Server env vars (DATABASE_URL, DBOS_DATABASE_URL, API keys, CORS)
- `apps/web/.env.local` — Web env vars (DATABASE_URL, NEXT_PUBLIC_API_URL, NextAuth, Google OAuth)
- See `.env.example` files for required variables

### Pre-existing lint issues

The web app has pre-existing ESLint errors (unused imports in several components, service worker globals in `public/sw.js`). The server app lints clean. These are known issues in the existing codebase.

### No automated tests

This codebase has no test framework or test files configured. Manual testing via browser is the primary validation method.
