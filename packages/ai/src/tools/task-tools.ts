import { tool } from "ai";
import { z } from "zod";
import { tasks, familyMembers } from "@home/db/schema";
import { eq, and, desc, asc } from "drizzle-orm";
import type { ToolContext } from "../types.js";

export const createTaskTool = (context: ToolContext) =>
  tool({
    description: "Create a new task in the household task list",
    inputSchema: z.object({
      title: z.string().describe("The task title"),
      description: z.string().optional().describe("Optional task description"),
      dueDate: z.string().optional().describe("Optional due date (ISO 8601 format, e.g., 2024-03-15)"),
      themeId: z.string().uuid().optional().describe("Optional theme ID to categorize the task"),
      projectId: z.string().uuid().optional().describe("Optional project ID"),
      assignedToId: z.string().uuid().optional().describe("Optional family member ID to assign the task to"),
      priority: z.number().min(0).max(2).optional().describe("0 = normal, 1 = high, 2 = urgent"),
    }),
    execute: async (input) => {
      const [task] = await context.db
        .insert(tasks)
        .values({
          householdId: context.householdId,
          createdById: context.userId,
          title: input.title,
          description: input.description,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
          themeId: input.themeId,
          projectId: input.projectId,
          assignedToId: input.assignedToId,
          priority: input.priority ?? 0,
        })
        .returning();

      if (!task) {
        return { success: false, error: "Failed to create task" };
      }

      return {
        success: true,
        message: `Created task: "${task.title}"`,
        task: {
          id: task.id,
          title: task.title,
          dueDate: task.dueDate?.toISOString() ?? null,
        },
      };
    },
  });

export const listTasksTool = (context: ToolContext) =>
  tool({
    description: "List tasks, optionally filtered by status, theme, project, or assignee",
    inputSchema: z.object({
      status: z.enum(["todo", "in_progress", "done", "archived"]).optional().describe("Filter by task status"),
      themeId: z.string().uuid().optional().describe("Filter by theme ID"),
      projectId: z.string().uuid().optional().describe("Filter by project ID"),
      assignedToId: z.string().uuid().optional().describe("Filter by assigned family member ID"),
      limit: z.number().min(1).max(50).optional().describe("Maximum number of tasks to return (default 10)"),
    }),
    execute: async (input) => {
      const conditions = [eq(tasks.householdId, context.householdId)];

      if (input.status) {
        conditions.push(eq(tasks.status, input.status));
      }
      if (input.themeId) {
        conditions.push(eq(tasks.themeId, input.themeId));
      }
      if (input.projectId) {
        conditions.push(eq(tasks.projectId, input.projectId));
      }
      if (input.assignedToId) {
        conditions.push(eq(tasks.assignedToId, input.assignedToId));
      }

      const tasksList = await context.db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          dueDate: tasks.dueDate,
          priority: tasks.priority,
          assignedTo: {
            firstName: familyMembers.firstName,
            lastName: familyMembers.lastName,
          },
        })
        .from(tasks)
        .leftJoin(familyMembers, eq(tasks.assignedToId, familyMembers.id))
        .where(and(...conditions))
        .orderBy(desc(tasks.priority), asc(tasks.dueDate))
        .limit(input.limit ?? 10);

      return {
        count: tasksList.length,
        tasks: tasksList.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
          priority: t.priority === 2 ? "urgent" : t.priority === 1 ? "high" : "normal",
          assignedTo: t.assignedTo?.firstName
            ? `${t.assignedTo.firstName}${t.assignedTo.lastName ? ` ${t.assignedTo.lastName}` : ""}`
            : null,
        })),
      };
    },
  });

export const completeTaskTool = (context: ToolContext) =>
  tool({
    description: "Mark a task as completed",
    inputSchema: z.object({
      taskId: z.string().uuid().describe("The ID of the task to complete"),
    }),
    execute: async (input) => {
      const [existingTask] = await context.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, input.taskId), eq(tasks.householdId, context.householdId)))
        .limit(1);

      if (!existingTask) {
        return { success: false, error: "Task not found" };
      }

      const now = new Date();
      await context.db
        .update(tasks)
        .set({
          status: "done",
          lastCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(tasks.id, input.taskId));

      return {
        success: true,
        message: `Completed task: "${existingTask.title}"`,
      };
    },
  });

export const updateTaskTool = (context: ToolContext) =>
  tool({
    description: "Update a task's details",
    inputSchema: z.object({
      taskId: z.string().uuid().describe("The ID of the task to update"),
      title: z.string().optional().describe("New title"),
      description: z.string().optional().describe("New description"),
      dueDate: z.string().optional().describe("New due date (ISO 8601 format)"),
      status: z.enum(["todo", "in_progress", "done", "archived"]).optional().describe("New status"),
      assignedToId: z.string().uuid().optional().describe("New assignee family member ID"),
      priority: z.number().min(0).max(2).optional().describe("New priority (0-2)"),
    }),
    execute: async (input) => {
      const { taskId, ...updates } = input;

      const [existingTask] = await context.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.householdId, context.householdId)))
        .limit(1);

      if (!existingTask) {
        return { success: false, error: "Task not found" };
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.title) updateData.title = updates.title;
      if (updates.description) updateData.description = updates.description;
      if (updates.dueDate) updateData.dueDate = new Date(updates.dueDate);
      if (updates.status) updateData.status = updates.status;
      if (updates.assignedToId) updateData.assignedToId = updates.assignedToId;
      if (updates.priority !== undefined) updateData.priority = updates.priority;

      await context.db.update(tasks).set(updateData).where(eq(tasks.id, taskId));

      return {
        success: true,
        message: `Updated task: "${existingTask.title}"`,
      };
    },
  });
