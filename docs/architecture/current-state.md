# Current State Architecture

## Overview

This monorepo contains a household management product with two runtime surfaces:

- `apps/web`: Next.js 15 application that handles the UI, session management, and browser-only interactions.
- `apps/server`: Hono API backed by DBOS workflows, Drizzle ORM, and AI SDK integrations.

Shared packages provide the data model and AI contract surface:

- `packages/db`: schema exports, migrations, and the Neon-backed Drizzle client.
- `packages/shared`: shared types and Zod contracts consumed by frontend and backend.
- `packages/ai`: prompt builders, research helpers, and tool definitions for model-driven actions.

## Main Runtime Paths

### Web App

- Uses `next-auth` for session management.
- Proxies API calls through `/api/v1/*` to the backend in `apps/web/next.config.ts`.
- Renders chat, task, project, recipe, meal-planning, and research UI flows.

### API Server

- Defines the Hono app and mounts all API routers from `apps/server/src/routes`.
- Uses auth middleware on `/api/*`.
- Exposes `/health` and `/openapi.json`.
- Runs DBOS alongside the API server for long-running workflows such as deep research.

### AI Surfaces

The main AI execution entrypoints are:

- `apps/server/src/routes/ai.ts`: conversational chat with tool calling and conversation persistence.
- `apps/server/src/services/research-service.ts`: planning, execution, scoring, and reporting for deep research runs.
- `apps/server/src/services/task-agent-service.ts`: task comment `@ai` assistant flow.
- `apps/server/src/routes/recipes.ts`: recipe extraction and AI-assisted recipe creation.

### Database Model

- All application data is scoped by `householdId`.
- Drizzle schemas are exported from `packages/db/src/schema/index.ts`.
- The database client is created in `packages/db/src/client.ts`.
- Research and chat persistence already capture useful run artifacts that can support future replay and eval work.

## Architectural Expectations

- Apps should depend on shared code through `packages/*`, not import directly from another app.
- Runtime behavior should be represented in repository-local docs, not only in prompts or chat context.
- New backend routes should live in `apps/server/src/routes` and be mounted in the main server app.
- New schema files should be exported from `packages/db/src/schema/index.ts`.
