# AGENTS.md

## Cursor Cloud specific instructions

### Overview

This is a Turborepo monorepo for a "Home Management" household app. Two main services:

| Service | Port | Package | Command |
|---|---|---|---|
| **Frontend** (Next.js 15 PWA) | 3000 | `@home/web` | `yarn workspace @home/web dev` |
| **Backend** (Hono + DBOS API) | 3001 | `@home/server` | `yarn workspace @home/server dev` |

Shared packages: `@home/db` (Drizzle ORM / Neon), `@home/shared` (types/constants), `@home/ai` (AI tool defs).

### Key development caveats

- **Node 20** is required (see `.nvmrc`). Enable corepack: `corepack enable && corepack prepare yarn@4.6.0 --activate`.
- **Yarn 4 (Berry)** with `node-modules` linker. Use `yarn install` (not npm/pnpm).
- **Build order matters**: `@home/db` → `@home/shared` → `@home/ai` → `@home/server`. The server's `dev` script handles this chain automatically.
- **Neon serverless driver** (`@neondatabase/serverless`) uses HTTP, not standard `pg` TCP. A local PostgreSQL alone won't work. You must run the `local-neon-http-proxy` Docker container and preload `neon-local-config.mjs` via `NODE_OPTIONS="--import=/workspace/neon-local-config.mjs"`.
- **PostgreSQL** must be running locally (`sudo pg_ctlcluster 16 main start`) with a database `home_management` and a superuser role (needed for the neon proxy to access `pg_authid`).
- **Docker** must be running (`sudo dockerd &`) for the neon-http-proxy container: `sudo docker start neon-proxy` (or create with `sudo docker run -d --name neon-proxy -p 4444:4444 -e PG_CONNECTION_STRING="postgresql://homeuser:homepass@172.17.0.1:5432/home_management" ghcr.io/timowilhelm/local-neon-http-proxy:main`).
- **Schema push**: Use `DATABASE_URL="postgresql://homeuser:homepass@localhost:5432/home_management" npx drizzle-kit push` from `packages/db/` to sync schema to local PG.
- **Environment files**: `apps/server/.env` and `apps/web/.env.local` (see `.env.example` files in each). Set `DATABASE_URL` host to `db.localtest.me` for the neon HTTP driver; set `DBOS_DATABASE_URL` to `localhost` for DBOS direct connection.
- **Google OAuth** credentials are required for login (set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`). Without them, the login page loads but auth won't work.
- **Lint/typecheck/build**: `yarn lint`, `yarn typecheck`, `yarn build` from root. No automated tests exist in the codebase.

### Dev login

A credentials-based login is available for local development (gated behind `DEV_LOGIN_ENABLED=true` in `apps/web/.env.local`). Use any email with password `devpass123` (or whatever `DEV_LOGIN_PASSWORD` is set to). The login page will show both Google OAuth and a Dev Login form. A user, household, and family member are auto-created on first sign-in.

### Starting services

```bash
# 1. Start PostgreSQL
sudo pg_ctlcluster 16 main start

# 2. Start Docker + neon proxy
sudo dockerd &
sleep 3
sudo docker start neon-proxy

# 3. Start backend (port 3001)
cd /workspace/apps/server && npx tsx watch --env-file=.env src/index.ts &

# 4. Start frontend (port 3000)
cd /workspace && yarn workspace @home/web dev &
```
