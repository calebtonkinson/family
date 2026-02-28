import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { tasks, familyMembers, themes, projects, users } from "@home/db/schema";
import {
  createTaskSchema,
  updateTaskSchema,
  taskFilterSchema,
  idParamSchema,
  paginationSchema,
} from "@home/shared";
import { eq, and, sql, desc, asc, lte, gte } from "drizzle-orm";
import { calculateNextDueDate } from "../services/task-service.js";
import { NotificationService } from "../services/notification-service.js";

export const tasksRouter = new OpenAPIHono();

const taskStatusLabel: Record<"todo" | "in_progress" | "done" | "archived", string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  archived: "Archived",
};

const taskPriorityLabel: Record<number, string> = {
  0: "Normal",
  1: "High",
  2: "Urgent",
};

function formatDueDate(dueDate: Date | null): string {
  if (!dueDate) return "No due date";
  return dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function actorNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "Someone";
  return localPart
    .split(/[._-]/g)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

async function getUserIdForFamilyMember(
  householdId: string,
  familyMemberId: string | null,
): Promise<string | null> {
  if (!familyMemberId) return null;
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.householdId, householdId),
        eq(users.familyMemberId, familyMemberId),
      ),
    )
    .limit(1);
  return user?.id ?? null;
}

// Task response schema for OpenAPI
const taskResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  themeId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.enum(["todo", "in_progress", "done", "archived"]),
  assignedToId: z.string().uuid().nullable(),
  createdById: z.string().uuid(),
  dueDate: z.string().nullable(),
  isRecurring: z.boolean(),
  recurrenceType: z
    .enum(["daily", "weekly", "monthly", "yearly", "custom_days"])
    .nullable(),
  recurrenceInterval: z.number().nullable(),
  nextDueDate: z.string().nullable(),
  lastCompletedAt: z.string().nullable(),
  priority: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignedTo: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string().nullable(),
    })
    .nullable()
    .optional(),
  theme: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string().nullable(),
    })
    .nullable()
    .optional(),
  project: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
});

// List tasks
const listTasksRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: taskFilterSchema.merge(paginationSchema),
  },
  responses: {
    200: {
      description: "List of tasks",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(taskResponseSchema),
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

tasksRouter.openapi(listTasksRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const conditions = [eq(tasks.householdId, auth.householdId)];

  if (query.status) {
    conditions.push(eq(tasks.status, query.status));
  }
  if (query.themeId) {
    conditions.push(eq(tasks.themeId, query.themeId));
  }
  if (query.projectId) {
    conditions.push(eq(tasks.projectId, query.projectId));
  }
  if (query.assignedToId) {
    conditions.push(eq(tasks.assignedToId, query.assignedToId));
  }
  if (query.isRecurring !== undefined) {
    conditions.push(eq(tasks.isRecurring, query.isRecurring));
  }
  if (query.dueBefore) {
    conditions.push(lte(tasks.dueDate, new Date(query.dueBefore)));
  }
  if (query.dueAfter) {
    conditions.push(gte(tasks.dueDate, new Date(query.dueAfter)));
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;

  const [tasksList, countResult] = await Promise.all([
    db
      .select({
        task: tasks,
        assignedTo: {
          id: familyMembers.id,
          firstName: familyMembers.firstName,
          lastName: familyMembers.lastName,
        },
        theme: {
          id: themes.id,
          name: themes.name,
          color: themes.color,
        },
        project: {
          id: projects.id,
          name: projects.name,
        },
      })
      .from(tasks)
      .leftJoin(familyMembers, eq(tasks.assignedToId, familyMembers.id))
      .leftJoin(themes, eq(tasks.themeId, themes.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(...conditions))
      .orderBy(desc(tasks.priority), asc(tasks.dueDate), desc(tasks.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...conditions)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const data = tasksList.map((row) => ({
    ...row.task,
    dueDate: row.task.dueDate?.toISOString() ?? null,
    nextDueDate: row.task.nextDueDate?.toISOString() ?? null,
    lastCompletedAt: row.task.lastCompletedAt?.toISOString() ?? null,
    createdAt: row.task.createdAt.toISOString(),
    updatedAt: row.task.updatedAt.toISOString(),
    isRecurring: row.task.isRecurring ?? false,
    priority: row.task.priority ?? 0,
    assignedTo: row.assignedTo?.id ? row.assignedTo : null,
    theme: row.theme?.id ? row.theme : null,
    project: row.project?.id ? row.project : null,
  }));

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

// Get single task
const getTaskRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Task details",
      content: {
        "application/json": {
          schema: z.object({ data: taskResponseSchema }),
        },
      },
    },
    404: {
      description: "Task not found",
    },
  },
});

tasksRouter.openapi(getTaskRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [result] = await db
    .select({
      task: tasks,
      assignedTo: {
        id: familyMembers.id,
        firstName: familyMembers.firstName,
        lastName: familyMembers.lastName,
      },
      theme: {
        id: themes.id,
        name: themes.name,
        color: themes.color,
      },
      project: {
        id: projects.id,
        name: projects.name,
      },
    })
    .from(tasks)
    .leftJoin(familyMembers, eq(tasks.assignedToId, familyMembers.id))
    .leftJoin(themes, eq(tasks.themeId, themes.id))
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, id), eq(tasks.householdId, auth.householdId)))
    .limit(1);

  if (!result) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({
    data: {
      ...result.task,
      dueDate: result.task.dueDate?.toISOString() ?? null,
      nextDueDate: result.task.nextDueDate?.toISOString() ?? null,
      lastCompletedAt: result.task.lastCompletedAt?.toISOString() ?? null,
      createdAt: result.task.createdAt.toISOString(),
      updatedAt: result.task.updatedAt.toISOString(),
      isRecurring: result.task.isRecurring ?? false,
      assignedTo: result.assignedTo?.id ? result.assignedTo : null,
      theme: result.theme?.id ? result.theme : null,
      project: result.project?.id ? result.project : null,
    },
  });
});

// Create task
const createTaskRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createTaskSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Task created",
      content: {
        "application/json": {
          schema: z.object({ data: taskResponseSchema }),
        },
      },
    },
  },
});

tasksRouter.openapi(createTaskRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [task] = await db
    .insert(tasks)
    .values({
      householdId: auth.householdId,
      createdById: auth.userId,
      title: body.title,
      description: body.description,
      themeId: body.themeId,
      projectId: body.projectId,
      assignedToId: body.assignedToId,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      isRecurring: body.isRecurring,
      recurrenceType: body.recurrenceType,
      recurrenceInterval: body.recurrenceInterval,
      priority: body.priority ?? 0,
    })
    .returning();

  if (!task) {
    throw new Error("Failed to create task");
  }

  if (task.assignedToId) {
    const assigneeUserId = await getUserIdForFamilyMember(
      auth.householdId,
      task.assignedToId,
    );
    if (assigneeUserId && assigneeUserId !== auth.userId) {
      const actorName = actorNameFromEmail(auth.email);
      await NotificationService.sendUserNotification(assigneeUserId, {
        title: "New task assigned",
        body: `${actorName} assigned "${task.title}" • Due ${formatDueDate(task.dueDate ?? null)}`,
        url: `/tasks/${task.id}`,
        data: {
          type: "task_assigned",
          taskId: task.id,
        },
      }).catch((error) => {
        console.error("[Tasks] Failed to send assignment notification:", error);
      });
    }
  }

  return c.json(
    {
      data: {
        id: task.id,
        householdId: task.householdId,
        title: task.title,
        description: task.description,
        status: task.status,
        themeId: task.themeId,
        projectId: task.projectId,
        assignedToId: task.assignedToId,
        createdById: task.createdById,
        dueDate: task.dueDate?.toISOString() ?? null,
        nextDueDate: task.nextDueDate?.toISOString() ?? null,
        lastCompletedAt: task.lastCompletedAt?.toISOString() ?? null,
        createdAt: task.createdAt.toISOString(),
        updatedAt: task.updatedAt.toISOString(),
        isRecurring: task.isRecurring ?? false,
        recurrenceType: task.recurrenceType,
        recurrenceInterval: task.recurrenceInterval,
        priority: task.priority ?? 0,
      },
    },
    201,
  );
});

// Update task
const updateTaskRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateTaskSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Task updated",
      content: {
        "application/json": {
          schema: z.object({ data: taskResponseSchema }),
        },
      },
    },
    404: {
      description: "Task not found",
    },
  },
});

tasksRouter.openapi(updateTaskRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.householdId, auth.householdId)))
    .limit(1);

  if (!existingTask) {
    return c.json({ error: "Task not found" }, 404);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.status !== undefined) updateData.status = body.status;
  if (body.themeId !== undefined) updateData.themeId = body.themeId;
  if (body.projectId !== undefined) updateData.projectId = body.projectId;
  if (body.assignedToId !== undefined)
    updateData.assignedToId = body.assignedToId;
  if (body.dueDate !== undefined) {
    updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
  }
  if (body.isRecurring !== undefined) {
    updateData.isRecurring = body.isRecurring;
    if (!body.isRecurring) {
      updateData.recurrenceType = null;
      updateData.recurrenceInterval = null;
      updateData.nextDueDate = null;
    }
  }
  if (body.recurrenceType !== undefined)
    updateData.recurrenceType = body.recurrenceType;
  if (body.recurrenceInterval !== undefined)
    updateData.recurrenceInterval = body.recurrenceInterval;
  if (body.priority !== undefined) updateData.priority = body.priority;

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(and(eq(tasks.id, id), eq(tasks.householdId, auth.householdId)))
    .returning();

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const assignmentChanged = existingTask.assignedToId !== task.assignedToId;
  const statusChanged = body.status !== undefined && body.status !== existingTask.status;
  const dueDateChanged =
    body.dueDate !== undefined &&
    (existingTask.dueDate?.toISOString() ?? null) !==
      (task.dueDate?.toISOString() ?? null);
  const priorityChanged =
    body.priority !== undefined && body.priority !== existingTask.priority;
  const titleChanged = body.title !== undefined && body.title !== existingTask.title;
  const actorName = actorNameFromEmail(auth.email);

  if (assignmentChanged) {
    const [newAssigneeUserId, previousAssigneeUserId] = await Promise.all([
      getUserIdForFamilyMember(auth.householdId, task.assignedToId),
      getUserIdForFamilyMember(auth.householdId, existingTask.assignedToId),
    ]);

    if (newAssigneeUserId && newAssigneeUserId !== auth.userId) {
      await NotificationService.sendUserNotification(newAssigneeUserId, {
        title: "Task assigned to you",
        body: `${actorName} assigned "${task.title}" • Due ${formatDueDate(task.dueDate ?? null)}`,
        url: `/tasks/${task.id}`,
        data: {
          type: "task_assigned",
          taskId: task.id,
        },
      }).catch((error) => {
        console.error("[Tasks] Failed to send assignee notification:", error);
      });
    }

    if (
      previousAssigneeUserId &&
      previousAssigneeUserId !== auth.userId &&
      previousAssigneeUserId !== newAssigneeUserId
    ) {
      const bodyText = task.assignedToId
        ? `${actorName} reassigned "${task.title}" to another person`
        : `${actorName} unassigned "${task.title}"`;

      await NotificationService.sendUserNotification(previousAssigneeUserId, {
        title: "Task assignment changed",
        body: bodyText,
        url: `/tasks/${task.id}`,
        data: {
          type: "task_reassigned",
          taskId: task.id,
        },
      }).catch((error) => {
        console.error("[Tasks] Failed to send reassignment notification:", error);
      });
    }
  } else if (task.assignedToId) {
    const assigneeUserId = await getUserIdForFamilyMember(
      auth.householdId,
      task.assignedToId,
    );
    if (assigneeUserId && assigneeUserId !== auth.userId) {
      const updates: string[] = [];
      if (statusChanged) {
        updates.push(`status: ${taskStatusLabel[task.status]}`);
      }
      if (dueDateChanged) {
        updates.push(`due: ${formatDueDate(task.dueDate ?? null)}`);
      }
      if (priorityChanged) {
        updates.push(`priority: ${taskPriorityLabel[task.priority ?? 0]}`);
      }
      if (titleChanged) {
        updates.push("title updated");
      }

      if (updates.length > 0) {
        await NotificationService.sendUserNotification(assigneeUserId, {
          title: "Task updated",
          body: `${actorName} updated "${task.title}" (${updates.join(", ")})`,
          url: `/tasks/${task.id}`,
          data: {
            type: "task_updated",
            taskId: task.id,
          },
        }).catch((error) => {
          console.error("[Tasks] Failed to send task update notification:", error);
        });
      }
    }
  }

  return c.json({
    data: {
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
      nextDueDate: task.nextDueDate?.toISOString() ?? null,
      lastCompletedAt: task.lastCompletedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      isRecurring: task.isRecurring ?? false,
    },
  });
});

// Complete task
const completeTaskRoute = createRoute({
  method: "post",
  path: "/:id/complete",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Task completed",
      content: {
        "application/json": {
          schema: z.object({ data: taskResponseSchema }),
        },
      },
    },
    404: {
      description: "Task not found",
    },
  },
});

tasksRouter.openapi(completeTaskRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  // Get the task first
  const [existingTask] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.householdId, auth.householdId)))
    .limit(1);

  if (!existingTask) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = new Date();
  const updateData: Record<string, unknown> = {
    status: "done",
    lastCompletedAt: now,
    updatedAt: now,
  };

  // Handle recurring tasks
  if (existingTask.isRecurring && existingTask.recurrenceType) {
    const nextDue = calculateNextDueDate(
      existingTask.dueDate || now,
      existingTask.recurrenceType,
      existingTask.recurrenceInterval || 1,
    );
    updateData.nextDueDate = nextDue;
    updateData.dueDate = nextDue;
    updateData.status = "todo"; // Reset for next occurrence
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();

  if (!task) {
    return c.json({ error: "Failed to update task" }, 500);
  }

  if (task.assignedToId) {
    const assigneeUserId = await getUserIdForFamilyMember(
      auth.householdId,
      task.assignedToId,
    );
    if (assigneeUserId && assigneeUserId !== auth.userId) {
      const actorName = actorNameFromEmail(auth.email);
      const message =
        existingTask.isRecurring && existingTask.recurrenceType
          ? `${actorName} completed "${task.title}" and rolled it to the next occurrence`
          : `${actorName} marked "${task.title}" as done`;

      await NotificationService.sendUserNotification(assigneeUserId, {
        title: "Task completed",
        body: message,
        url: `/tasks/${task.id}`,
        data: {
          type: "task_completed",
          taskId: task.id,
        },
      }).catch((error) => {
        console.error("[Tasks] Failed to send completion notification:", error);
      });
    }
  }

  return c.json({
    data: {
      ...task,
      dueDate: task.dueDate?.toISOString() ?? null,
      nextDueDate: task.nextDueDate?.toISOString() ?? null,
      lastCompletedAt: task.lastCompletedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      isRecurring: task.isRecurring ?? false,
    },
  });
});

// Delete task
const deleteTaskRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Task deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Task not found",
    },
  },
});

tasksRouter.openapi(deleteTaskRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ success: true });
});
