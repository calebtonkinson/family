import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { themes, projects, tasks } from "@home/db/schema";
import {
  createThemeSchema,
  updateThemeSchema,
  idParamSchema,
} from "@home/shared";
import { eq, and, sql, asc, inArray } from "drizzle-orm";

export const themesRouter = new OpenAPIHono();

const themeResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  color: z.string().nullable(),
  sortOrder: z.number(),
  createdAt: z.string(),
  projectCount: z.number().optional(),
  taskCount: z.number().optional(),
});

// List themes
const listThemesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "List of themes",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(themeResponseSchema),
          }),
        },
      },
    },
  },
});

themesRouter.openapi(listThemesRoute, async (c) => {
  const auth = c.get("auth");

  const themesList = await db
    .select()
    .from(themes)
    .where(eq(themes.householdId, auth.householdId))
    .orderBy(asc(themes.sortOrder), asc(themes.name));

  // Get counts for each theme
  const themeIds = themesList.map((t) => t.id);

  const [projectCounts, taskCounts] = await Promise.all([
    themeIds.length > 0
      ? db
          .select({
            themeId: projects.themeId,
            count: sql<number>`count(*)`,
          })
          .from(projects)
          .where(inArray(projects.themeId, themeIds))
          .groupBy(projects.themeId)
      : [],
    themeIds.length > 0
      ? db
          .select({
            themeId: tasks.themeId,
            count: sql<number>`count(*)`,
          })
          .from(tasks)
          .where(inArray(tasks.themeId, themeIds))
          .groupBy(tasks.themeId)
      : [],
  ]);

  const projectCountMap = new Map(projectCounts.map((pc) => [pc.themeId, Number(pc.count)]));
  const taskCountMap = new Map(taskCounts.map((tc) => [tc.themeId, Number(tc.count)]));

  const data = themesList.map((theme) => ({
    ...theme,
    createdAt: theme.createdAt.toISOString(),
    sortOrder: theme.sortOrder ?? 0,
    projectCount: projectCountMap.get(theme.id) || 0,
    taskCount: taskCountMap.get(theme.id) || 0,
  }));

  return c.json({ data });
});

// Get single theme
const getThemeRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Theme details",
      content: {
        "application/json": {
          schema: z.object({ data: themeResponseSchema }),
        },
      },
    },
    404: {
      description: "Theme not found",
    },
  },
});

themesRouter.openapi(getThemeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [theme] = await db
    .select()
    .from(themes)
    .where(and(eq(themes.id, id), eq(themes.householdId, auth.householdId)))
    .limit(1);

  if (!theme) {
    return c.json({ error: "Theme not found" }, 404);
  }

  // Get counts
  const [[projectCount], [taskCount]] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)` })
      .from(projects)
      .where(eq(projects.themeId, id)),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(eq(tasks.themeId, id)),
  ]);

  return c.json({
    data: {
      ...theme,
      createdAt: theme.createdAt.toISOString(),
      sortOrder: theme.sortOrder ?? 0,
      projectCount: Number(projectCount?.count ?? 0),
      taskCount: Number(taskCount?.count ?? 0),
    },
  });
});

// Create theme
const createThemeRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createThemeSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Theme created",
      content: {
        "application/json": {
          schema: z.object({ data: themeResponseSchema }),
        },
      },
    },
  },
});

themesRouter.openapi(createThemeRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [theme] = await db
    .insert(themes)
    .values({
      householdId: auth.householdId,
      name: body.name,
      icon: body.icon,
      color: body.color,
      sortOrder: body.sortOrder ?? 0,
    })
    .returning();

  if (!theme) {
    throw new Error("Failed to create theme");
  }

  return c.json(
    {
      data: {
        id: theme.id,
        name: theme.name,
        householdId: theme.householdId,
        icon: theme.icon,
        color: theme.color,
        createdAt: theme.createdAt.toISOString(),
        sortOrder: theme.sortOrder ?? 0,
        projectCount: 0,
        taskCount: 0,
      },
    },
    201
  );
});

// Update theme
const updateThemeRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateThemeSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Theme updated",
      content: {
        "application/json": {
          schema: z.object({ data: themeResponseSchema }),
        },
      },
    },
    404: {
      description: "Theme not found",
    },
  },
});

themesRouter.openapi(updateThemeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = {};

  if (body.name !== undefined) updateData.name = body.name;
  if (body.icon !== undefined) updateData.icon = body.icon;
  if (body.color !== undefined) updateData.color = body.color;
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;

  const [theme] = await db
    .update(themes)
    .set(updateData)
    .where(and(eq(themes.id, id), eq(themes.householdId, auth.householdId)))
    .returning();

  if (!theme) {
    return c.json({ error: "Theme not found" }, 404);
  }

  return c.json({
    data: {
      ...theme,
      createdAt: theme.createdAt.toISOString(),
      sortOrder: theme.sortOrder ?? 0,
    },
  });
});

// Delete theme
const deleteThemeRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Theme deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Theme not found",
    },
  },
});

themesRouter.openapi(deleteThemeRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(themes)
    .where(and(eq(themes.id, id), eq(themes.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Theme not found" }, 404);
  }

  return c.json({ success: true });
});
