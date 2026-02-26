import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { projects, themes, tasks } from "@home/db/schema";
import {
  createProjectSchema,
  updateProjectSchema,
  idParamSchema,
  paginationSchema,
} from "@home/shared";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export const projectsRouter = new OpenAPIHono();

const projectResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  themeId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  theme: z.object({
    id: z.string().uuid(),
    name: z.string(),
    color: z.string().nullable(),
  }).nullable().optional(),
  taskCount: z.number().optional(),
  completedTaskCount: z.number().optional(),
});

// List projects
const listProjectsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: paginationSchema.extend({
      themeId: z.string().uuid().optional(),
      isActive: z.coerce.boolean().optional(),
    }),
  },
  responses: {
    200: {
      description: "List of projects",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(projectResponseSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

projectsRouter.openapi(listProjectsRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const conditions = [eq(projects.householdId, auth.householdId)];

  if (query.themeId) {
    conditions.push(eq(projects.themeId, query.themeId));
  }
  if (query.isActive !== undefined) {
    conditions.push(eq(projects.isActive, query.isActive));
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;

  const [projectsList, countResult] = await Promise.all([
    db
      .select({
        project: projects,
        theme: {
          id: themes.id,
          name: themes.name,
          color: themes.color,
        },
      })
      .from(projects)
      .leftJoin(themes, eq(projects.themeId, themes.id))
      .where(and(...conditions))
      .orderBy(desc(projects.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(and(...conditions)),
  ]);

  // Get task counts for each project
  const projectIds = projectsList.map((p) => p.project.id);
  const taskCounts = projectIds.length > 0
    ? await db
        .select({
          projectId: tasks.projectId,
          total: sql<number>`count(*)`,
          completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
        })
        .from(tasks)
        .where(inArray(tasks.projectId, projectIds))
        .groupBy(tasks.projectId)
    : [];

  const taskCountMap = new Map(
    taskCounts.map((tc) => [tc.projectId, { total: Number(tc.total), completed: Number(tc.completed) }])
  );

  const total = Number(countResult[0]?.count ?? 0);

  const data = projectsList.map((row) => {
    const counts = taskCountMap.get(row.project.id) || { total: 0, completed: 0 };
    return {
      ...row.project,
      dueDate: row.project.dueDate?.toISOString() ?? null,
      createdAt: row.project.createdAt.toISOString(),
      isActive: row.project.isActive ?? true,
      theme: row.theme?.id ? row.theme : null,
      taskCount: counts.total,
      completedTaskCount: counts.completed,
    };
  });

  return c.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get single project
const getProjectRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Project details",
      content: {
        "application/json": {
          schema: z.object({ data: projectResponseSchema }),
        },
      },
    },
    404: {
      description: "Project not found",
    },
  },
});

projectsRouter.openapi(getProjectRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [result] = await db
    .select({
      project: projects,
      theme: {
        id: themes.id,
        name: themes.name,
        color: themes.color,
      },
    })
    .from(projects)
    .leftJoin(themes, eq(projects.themeId, themes.id))
    .where(and(eq(projects.id, id), eq(projects.householdId, auth.householdId)))
    .limit(1);

  if (!result) {
    return c.json({ error: "Project not found" }, 404);
  }

  // Get task counts
  const [taskCount] = await db
    .select({
      total: sql<number>`count(*)`,
      completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
    })
    .from(tasks)
    .where(eq(tasks.projectId, id));

  return c.json({
    data: {
      ...result.project,
      dueDate: result.project.dueDate?.toISOString() ?? null,
      createdAt: result.project.createdAt.toISOString(),
      isActive: result.project.isActive ?? true,
      theme: result.theme?.id ? result.theme : null,
      taskCount: Number(taskCount?.total ?? 0),
      completedTaskCount: Number(taskCount?.completed ?? 0),
    },
  });
});

// Create project
const createProjectRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createProjectSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Project created",
      content: {
        "application/json": {
          schema: z.object({ data: projectResponseSchema }),
        },
      },
    },
  },
});

projectsRouter.openapi(createProjectRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [project] = await db
    .insert(projects)
    .values({
      householdId: auth.householdId,
      name: body.name,
      description: body.description,
      themeId: body.themeId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    })
    .returning();

  if (!project) {
    throw new Error("Failed to create project");
  }

  return c.json(
    {
      data: {
        id: project.id,
        householdId: project.householdId,
        themeId: project.themeId ?? null,
        name: project.name,
        description: project.description ?? null,
        isActive: project.isActive ?? true,
        dueDate: project.dueDate?.toISOString() ?? null,
        createdAt: project.createdAt.toISOString(),
        taskCount: 0,
        completedTaskCount: 0,
      },
    },
    201
  );
});

// Update project
const updateProjectRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateProjectSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Project updated",
      content: {
        "application/json": {
          schema: z.object({ data: projectResponseSchema }),
        },
      },
    },
    404: {
      description: "Project not found",
    },
  },
});

projectsRouter.openapi(updateProjectRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.themeId !== undefined) updateData.themeId = body.themeId;
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const [project] = await db
    .update(projects)
    .set(updateData)
    .where(and(eq(projects.id, id), eq(projects.householdId, auth.householdId)))
    .returning();

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    data: {
      ...project,
      dueDate: project.dueDate?.toISOString() ?? null,
      createdAt: project.createdAt.toISOString(),
      isActive: project.isActive ?? true,
    },
  });
});

// Delete project
const deleteProjectRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Project deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Project not found",
    },
  },
});

projectsRouter.openapi(deleteProjectRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ success: true });
});
