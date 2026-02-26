import { tool } from "ai";
import { z } from "zod";
import { themes, projects, tasks } from "@home/db/schema";
import { eq, sql, asc, inArray } from "drizzle-orm";
import type { ToolContext } from "../types.js";

export const listThemesTool = (context: ToolContext) =>
  tool({
    description: "List all themes (categories) in the household",
    inputSchema: z.object({}),
    execute: async () => {
      const themesList = await context.db
        .select({
          id: themes.id,
          name: themes.name,
          icon: themes.icon,
          color: themes.color,
        })
        .from(themes)
        .where(eq(themes.householdId, context.householdId))
        .orderBy(asc(themes.sortOrder));

      // Get counts
      const themeIds = themesList.map((t) => t.id);

      type CountResult = { themeId: string | null; count: number };

      const projectCountMap = new Map<string | null, number>();
      const taskCountMap = new Map<string | null, number>();

      if (themeIds.length > 0) {
        const projectCounts = await context.db
          .select({
            themeId: projects.themeId,
            count: sql<number>`count(*)`,
          })
          .from(projects)
          .where(inArray(projects.themeId, themeIds))
          .groupBy(projects.themeId) as CountResult[];

        const taskCounts = await context.db
          .select({
            themeId: tasks.themeId,
            count: sql<number>`count(*)`,
          })
          .from(tasks)
          .where(inArray(tasks.themeId, themeIds))
          .groupBy(tasks.themeId) as CountResult[];

        projectCounts.forEach((pc) => projectCountMap.set(pc.themeId, Number(pc.count)));
        taskCounts.forEach((tc) => taskCountMap.set(tc.themeId, Number(tc.count)));
      }

      return {
        count: themesList.length,
        themes: themesList.map((t) => ({
          id: t.id,
          name: t.name,
          icon: t.icon,
          color: t.color,
          projectCount: projectCountMap.get(t.id) || 0,
          taskCount: taskCountMap.get(t.id) || 0,
        })),
      };
    },
  });

export const createThemeTool = (context: ToolContext) =>
  tool({
    description: "Create a new theme (category) for organizing tasks and projects",
    inputSchema: z.object({
      name: z.string().describe("The theme name"),
      icon: z.string().optional().describe("Optional icon name (e.g., 'home', 'car', 'heart')"),
      color: z.string().optional().describe("Optional hex color (e.g., '#4A90D9')"),
    }),
    execute: async (input) => {
      const [theme] = await context.db
        .insert(themes)
        .values({
          householdId: context.householdId,
          name: input.name,
          icon: input.icon,
          color: input.color,
        })
        .returning();

      if (!theme) {
        return { success: false, error: "Failed to create theme" };
      }

      return {
        success: true,
        message: `Created theme: "${theme.name}"`,
        theme: {
          id: theme.id,
          name: theme.name,
        },
      };
    },
  });
