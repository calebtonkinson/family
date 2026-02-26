# Deep Research Feature Plan (Execution Spec)

## 1) Scope Decision
This plan intentionally focuses on:
- High-quality pre-run research planning
- Adaptive effort controls (how deep/long to search)

This plan intentionally excludes for now:
- Source policy UI (domain allow/deny controls)
- In-run interrupt/refine flows
- External connectors
- Quotas/scheduler

## 2) Product Goal
Deliver a deep-research mode in chat that:
1. Produces a clear research plan before execution
2. Uses the right search effort for the request (quick vs deep)
3. Returns structured, citation-backed findings with confidence and explicit unknowns
4. Lets users convert findings into tasks/projects

## 3) Existing System Reuse
Use existing architecture as the base:
- Chat streaming + tool persistence: `apps/server/src/routes/ai.ts`
- Task agent with web search: `apps/server/src/services/task-agent-service.ts`
- Conversation + tool history retrieval: `apps/server/src/routes/conversations.ts`
- Tool rendering UI: `apps/web/components/chat/tool-invocation-card.tsx`

## 4) Core Feature Requirements

### 4.1 Pre-Run Plan
Before running research, generate and show a plan:
- Objective (single sentence)
- Sub-questions (3-8)
- Assumptions
- Deliverable shape (summary/findings/unknowns/actions)
- Effort preset (`quick`, `standard`, `deep`)
- Recency preference (none/30d/90d/1y)

User can edit and approve plan, then execute.

### 4.2 Effort Presets
Map preset to execution budgets:

| Preset | Max Steps | Max Runtime | Min Sources | Max Re-queries / Sub-question |
|---|---:|---:|---:|---:|
| quick | 4 | 30s | 2 | 1 |
| standard | 8 | 90s | 4 | 2 |
| deep | 12 | 180s | 6 | 3 |

### 4.3 Adaptive Effort
For each sub-question:
- Track coverage state: `unanswered`, `partial`, `sufficient`
- Re-query only if confidence or source diversity is insufficient
- Stop when diminishing returns detected or budget reached

### 4.4 Output Contract
Final report must include:
1. Executive summary
2. Findings (claim, confidence, citations)
3. Unknowns / evidence gaps
4. Suggested next actions
5. Source list

## 5) Data Model Plan

### 5.1 New Tables
Add in `packages/db/src/schema/`:

1. `research_runs`
- `id` uuid pk
- `conversation_id` uuid fk -> conversations.id
- `household_id` uuid fk -> households.id
- `created_by_id` uuid fk -> users.id
- `status` enum(`planning`,`running`,`completed`,`failed`,`canceled`)
- `query` text
- `effort` enum(`quick`,`standard`,`deep`)
- `recency_days` int nullable
- `plan_json` jsonb
- `metrics_json` jsonb
- `error` text nullable
- `started_at` timestamp
- `completed_at` timestamp nullable
- `created_at`, `updated_at`

2. `research_sources`
- `id` uuid pk
- `research_run_id` uuid fk -> research_runs.id
- `url` text
- `title` text nullable
- `domain` text nullable
- `snippet` text nullable
- `published_at` timestamp nullable
- `retrieved_at` timestamp
- `score` numeric nullable
- `metadata_json` jsonb nullable
- `created_at`

3. `research_findings`
- `id` uuid pk
- `research_run_id` uuid fk -> research_runs.id
- `sub_question` text
- `claim` text
- `confidence` numeric
- `supporting_source_ids` jsonb (array of source ids)
- `status` enum(`partial`,`sufficient`,`conflicted`,`unknown`)
- `notes` text nullable
- `created_at`

4. `research_reports`
- `id` uuid pk
- `research_run_id` uuid fk -> research_runs.id
- `summary` text
- `report_markdown` text
- `actions_json` jsonb
- `created_at`

### 5.2 Migration
- Create a single migration for all 4 tables + enums + indexes
- Indexes:
  - `research_runs(conversation_id, created_at desc)`
  - `research_sources(research_run_id)`
  - `research_findings(research_run_id)`
  - unique `research_reports(research_run_id)`

## 6) Shared Types and API Contracts

### 6.1 Shared Zod Schemas
Add in `packages/shared/src/types/api.ts`:
- `createResearchPlanSchema`
- `runResearchSchema`
- `researchRunResponseSchema`
- `researchStatusResponseSchema`

### 6.2 Endpoints
Use conversation-scoped routes:

1. `POST /api/conversations/:id/research/plan`
- Input:
  - `query: string`
  - `effort?: "quick" | "standard" | "deep"`
  - `recencyDays?: number`
- Output:
  - `runId`
  - generated `plan`
  - normalized budget

2. `POST /api/conversations/:id/research/:runId/start`
- Input:
  - `plan` (possibly user-edited)
- Output:
  - `status: "running"`

3. `GET /api/conversations/:id/research/:runId`
- Output:
  - run metadata
  - plan
  - progress metrics
  - sources
  - findings
  - final report if complete

4. `POST /api/conversations/:id/research/:runId/tasks`
- Input:
  - selected findings/action items
- Output:
  - created task ids

## 7) Orchestration Design

### 7.1 New Service
Create `apps/server/src/services/research-service.ts` with:
- `createPlan(input): PlanResult`
- `startRun(runId, plan): Promise<void>`
- `getRunStatus(runId): RunStatus`
- `createTasksFromRun(runId, selection): TaskCreationResult`

### 7.2 Planning Phase
Model generates plan with strict schema:
- objective
- subQuestions[]
- assumptions[]
- outputFormat
- stopCriteria

Validate plan server-side:
- 3-8 sub-questions
- no empty fields
- effort budget mapped correctly

### 7.3 Execution Loop
For each sub-question:
1. Generate search query
2. Search
3. Extract claims + candidate evidence
4. Score evidence quality
5. Update sub-question state
6. Decide continue/stop using effort heuristic

Persist every stage incrementally.

### 7.4 Diminishing Returns Heuristic
Stop on any condition:
- confidence target met (`>=0.75`) and min sources satisfied
- no meaningful confidence delta after N retries
- budget exhausted (steps/time)

Suggested rule:
- if last 2 iterations improve confidence by `<0.05`, stop sub-question

## 8) Prompt and Tooling Strategy

### 8.1 Prompt Files
Add:
- `packages/ai/src/prompts/deep-research-plan.ts`
- `packages/ai/src/prompts/deep-research-execution.ts`

### 8.2 Prompt Contracts
Planner prompt output JSON:
- objective, subQuestions, assumptions, outputFormat, effortRationale

Execution prompt output JSON:
- findings array with claim/confidence/sourceIds/status
- unknowns array
- actions array

### 8.3 Tool Adapters
Add:
- `packages/ai/src/tools/research-tools.ts`

Tools:
- `searchWeb(query, recencyDays?)`
- `fetchSource(url)`
- `extractEvidence(text, subQuestion)`

Note:
- Wrap Anthropic native web search for normalized output shape.

## 9) Frontend Implementation Plan

### 9.1 Chat Composer Changes
File: `apps/web/components/chat/chat.tsx`
- Add `Deep Research` mode toggle
- Add effort selector (`Quick`, `Standard`, `Deep`)
- Add plan preview/edit panel before run starts

### 9.2 Research Progress UI
Files:
- `apps/web/components/chat/chat.tsx`
- `apps/web/components/chat/tool-invocation-card.tsx`

Display:
- phase (`planning`, `researching`, `synthesizing`, `complete`)
- sub-question progress
- source count and findings count

### 9.3 Report UI
Render structured sections:
- summary
- findings with inline citation chips
- unknowns
- action items with `Create Task` CTA

### 9.4 Conversation Hydration
File: `apps/web/app/(dashboard)/chat/[id]/page.tsx`
- load research run artifacts when opening existing conversation

## 10) Task Conversion Flow
Add endpoint + UI action:
- Select one or more action items/findings
- Create tasks via existing task creation path
- Link created tasks back to research run metadata

## 11) Observability
Track per run:
- effort preset
- duration
- step count
- source count
- findings count
- completion status
- failure reason

Log location:
- server logs from `research-service.ts`
- optional table metrics in `research_runs.metrics_json`

## 12) Test Plan

### 12.1 Backend Unit Tests
- plan generation validation
- effort budget mapping
- diminishing-returns stop logic
- citation completeness guard

### 12.2 Backend Integration Tests
- create plan -> start run -> complete
- run persistence (sources/findings/report)
- tasks creation from report actions

### 12.3 Frontend Tests
- effort selector + plan edit flow
- progress rendering by status
- report rendering and task conversion CTA

### 12.4 E2E Scenario
1. Start deep research from chat
2. Approve/edit plan
3. Run completes with citations
4. Convert 2 findings into tasks
5. Verify tasks exist and are linked

## 13) Definition of Done (MVP)
1. User can generate/edit/approve plan before execution.
2. Effort presets materially change run depth (steps/time/sources).
3. Completed reports include confidence + citations + unknowns.
4. User can create tasks from report actions in one flow.
5. Reloading conversation shows persisted plan/progress/report.
6. Automated tests cover plan logic and effort logic.

## 14) Delivery Plan (for Coding Agent)

### Sprint 1: Foundation (Week 1)
1. Add DB schema + migration for research tables
2. Add shared API schemas/types
3. Add `research-service.ts` skeleton
4. Add plan endpoint (`/research/plan`)

Exit criteria:
- Plan generation persisted in DB
- Endpoint test passing

### Sprint 2: Adaptive Execution (Week 2)
1. Implement execution loop with effort presets
2. Persist sources/findings/report artifacts
3. Implement status endpoint
4. Add core heuristics (confidence + diminishing returns)

Exit criteria:
- End-to-end run completes and stores artifacts

### Sprint 3: Frontend + Task Actions (Week 3)
1. Add deep research toggle + effort selector
2. Add plan review/edit UX
3. Add progress + report rendering
4. Add `create tasks from findings` flow

Exit criteria:
- Full user flow works in chat UI

### Sprint 4: Hardening (Week 4)
1. Add tests + edge case handling
2. Improve prompts and confidence calibration
3. Add logging/metrics dashboards
4. Fix quality issues from test runs

Exit criteria:
- MVP DoD met

## 15) First PR Breakdown (recommended sequence)
1. PR-1: DB schema + migration + shared types scaffolding
2. PR-2: research plan API + service skeleton + tests
3. PR-3: execution loop + persistence + status API + tests
4. PR-4: chat UI mode + effort selector + plan editor
5. PR-5: report rendering + task conversion + E2E

## 16) Open Questions (Resolve Before Build Starts)
1. Default effort preset: `standard`?
2. Should plan editing allow deleting sub-questions or only text edits?
3. Confidence threshold defaults per preset (`0.70` vs `0.75`)?
4. Max report length for UI readability?

