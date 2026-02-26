import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import {
  createResearchPlanSchema,
  runResearchSchema,
  createResearchPlanResponseSchema,
  researchStatusResponseSchema,
  createResearchTasksSchema,
} from "@home/shared";
import { researchService } from "../services/research-service.js";

export const researchRouter = new OpenAPIHono();

const conversationRunParamSchema = z.object({
  id: z.string().uuid(),
  runId: z.string().uuid(),
});

const conversationParamSchema = z.object({
  id: z.string().uuid(),
});

const createResearchPlanRoute = createRoute({
  method: "post",
  path: "/:id/research/plan",
  request: {
    params: conversationParamSchema,
    body: {
      content: {
        "application/json": {
          schema: createResearchPlanSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Research plan created",
      content: {
        "application/json": {
          schema: createResearchPlanResponseSchema,
        },
      },
    },
  },
});

researchRouter.openapi(createResearchPlanRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const result = await researchService.createPlan({
    conversationId: id,
    householdId: auth.householdId,
    userId: auth.userId,
    input: body,
  });

  return c.json(result);
});

const startResearchRunRoute = createRoute({
  method: "post",
  path: "/:id/research/:runId/start",
  request: {
    params: conversationRunParamSchema,
    body: {
      content: {
        "application/json": {
          schema: runResearchSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Research run started",
      content: {
        "application/json": {
          schema: z.object({ status: z.literal("running") }),
        },
      },
    },
  },
});

researchRouter.openapi(startResearchRunRoute, async (c) => {
  const auth = c.get("auth");
  const { id, runId } = c.req.valid("param");
  const body = c.req.valid("json");

  await researchService.startRun({
    conversationId: id,
    runId,
    householdId: auth.householdId,
    userId: auth.userId,
    input: body,
  });

  return c.json({ status: "running" as const });
});

const getResearchRunRoute = createRoute({
  method: "get",
  path: "/:id/research/:runId",
  request: {
    params: conversationRunParamSchema,
  },
  responses: {
    200: {
      description: "Research run status",
      content: {
        "application/json": {
          schema: researchStatusResponseSchema,
        },
      },
    },
  },
});

researchRouter.openapi(getResearchRunRoute, async (c) => {
  const auth = c.get("auth");
  const { id, runId } = c.req.valid("param");

  const result = await researchService.getRunStatus({
    conversationId: id,
    runId,
    householdId: auth.householdId,
  });

  return c.json(result);
});

const createTasksFromResearchRunRoute = createRoute({
  method: "post",
  path: "/:id/research/:runId/tasks",
  request: {
    params: conversationRunParamSchema,
    body: {
      content: {
        "application/json": {
          schema: createResearchTasksSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tasks created from research run",
      content: {
        "application/json": {
          schema: z.object({
            createdTaskIds: z.array(z.string().uuid()),
          }),
        },
      },
    },
  },
});

researchRouter.openapi(createTasksFromResearchRunRoute, async (c) => {
  const auth = c.get("auth");
  const { id, runId } = c.req.valid("param");
  const body = c.req.valid("json");

  const result = await researchService.createTasksFromRun({
    conversationId: id,
    runId,
    householdId: auth.householdId,
    userId: auth.userId,
    input: body,
  });

  return c.json(result);
});

const listResearchRunsRoute = createRoute({
  method: "get",
  path: "/:id/research",
  request: {
    params: conversationParamSchema,
  },
  responses: {
    200: {
      description: "List research runs for a conversation",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(
                z.object({
                  id: z.string().uuid(),
                  status: z.enum(["planning", "running", "completed", "completed_with_warnings", "failed", "canceled"]),
                  effort: z.enum(["quick", "standard", "deep"]),
                  query: z.string(),
                  createdAt: z.string(),
                  updatedAt: z.string(),
              }),
            ),
          }),
        },
      },
    },
  },
});

researchRouter.openapi(listResearchRunsRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const data = await researchService.listRunsForConversation({
    conversationId: id,
    householdId: auth.householdId,
  });

  return c.json({ data });
});
