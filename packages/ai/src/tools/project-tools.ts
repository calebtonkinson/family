import { tool } from "ai";
import { z } from "zod";
import { projects, themes, tasks } from "@home/db/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import type { ToolContext } from "../types.js";

export const createProjectTool = (context: ToolContext) =>
  tool({
    description: "Create a new project to group related tasks",
    inputSchema: z.object({
      name: z.string().describe("The project name"),
      description: z.string().optional().describe("Optional project description"),
      themeId: z.string().uuid().optional().describe("Optional theme ID to categorize the project"),
      dueDate: z.string().optional().describe("Optional due date (ISO 8601 format)"),
    }),
    execute: async (input) => {
      const [project] = await context.db
        .insert(projects)
        .values({
          householdId: context.householdId,
          name: input.name,
          description: input.description,
          themeId: input.themeId,
          dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
        })
        .returning();

      if (!project) {
        return { success: false, error: "Failed to create project" };
      }

      return {
        success: true,
        message: `Created project: "${project.name}"`,
        project: {
          id: project.id,
          name: project.name,
        },
      };
    },
  });

export const listProjectsTool = (context: ToolContext) =>
  tool({
    description: "List projects, optionally filtered by theme or active status",
    inputSchema: z.object({
      themeId: z.string().uuid().optional().describe("Filter by theme ID"),
      isActive: z.boolean().optional().describe("Filter by active status"),
      limit: z.number().min(1).max(50).optional().describe("Maximum number of projects to return"),
    }),
    execute: async (input) => {
      const conditions = [eq(projects.householdId, context.householdId)];

      if (input.themeId) {
        conditions.push(eq(projects.themeId, input.themeId));
      }
      if (input.isActive !== undefined) {
        conditions.push(eq(projects.isActive, input.isActive));
      }

      const projectsList = await context.db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
          isActive: projects.isActive,
          dueDate: projects.dueDate,
          theme: {
            name: themes.name,
          },
        })
        .from(projects)
        .leftJoin(themes, eq(projects.themeId, themes.id))
        .where(and(...conditions))
        .orderBy(desc(projects.createdAt))
        .limit(input.limit ?? 10);

      // Get task counts
      const projectIds = projectsList.map((p) => p.id);
      const taskCounts = projectIds.length > 0
        ? await context.db
            .select({
              projectId: tasks.projectId,
              total: sql<number>`count(*)`,
              completed: sql<number>`count(*) filter (where ${tasks.status} = 'done')`,
            })
            .from(tasks)
            .where(inArray(tasks.projectId, projectIds))
            .groupBy(tasks.projectId)
        : [];

      const countMap = new Map(
        taskCounts.map((tc) => [tc.projectId, { total: Number(tc.total), completed: Number(tc.completed) }])
      );

      return {
        count: projectsList.length,
        projects: projectsList.map((p) => {
          const counts = countMap.get(p.id) || { total: 0, completed: 0 };
          return {
            id: p.id,
            name: p.name,
            description: p.description,
            isActive: p.isActive,
            dueDate: p.dueDate?.toISOString().split("T")[0] ?? null,
            theme: p.theme?.name ?? null,
            taskCount: counts.total,
            completedTasks: counts.completed,
          };
        }),
      };
    },
  });
