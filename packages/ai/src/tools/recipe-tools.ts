import { tool } from "ai";
import { z } from "zod";
import { recipes } from "@home/db/schema";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { ToolContext } from "../types.js";

const ingredientSchema = z.object({
  name: z.string().min(1).describe("Ingredient name"),
  quantity: z.union([z.string(), z.number()]).optional().describe("Quantity value"),
  unit: z.string().optional().describe("Unit of measure (e.g., cup, tbsp)"),
  qualifiers: z.string().optional().describe("Optional qualifiers (e.g., chopped, low-sodium)"),
});

const recipeAttachmentSchema = z.object({
  url: z.string().min(1).describe("Attachment URL or data URL"),
  mediaType: z.string().min(1).describe("MIME type (e.g., image/jpeg, application/pdf)"),
  filename: z.string().optional().describe("Original filename"),
});

export const listRecipesTool = (context: ToolContext) =>
  tool({
    description: "List household recipes with optional title/tag filters",
    inputSchema: z.object({
      search: z.string().optional().describe("Optional search term for title or description"),
      tag: z.string().optional().describe("Optional tag filter (e.g., dinner, quick)"),
      limit: z.number().int().min(1).max(100).optional().describe("Maximum recipes to return"),
    }),
    execute: async (input) => {
      const conditions = [eq(recipes.householdId, context.householdId)];
      if (input.search) {
        const term = `%${input.search}%`;
        const searchCondition = or(
          ilike(recipes.title, term),
          ilike(recipes.description, term),
        );
        if (searchCondition) {
          conditions.push(searchCondition);
        }
      }
      if (input.tag) {
        conditions.push(sql<boolean>`${recipes.tags} ? ${input.tag}`);
      }

      const rows = await context.db
        .select({
          id: recipes.id,
          title: recipes.title,
          tags: recipes.tags,
          prepTimeMinutes: recipes.prepTimeMinutes,
          cookTimeMinutes: recipes.cookTimeMinutes,
          source: recipes.source,
        })
        .from(recipes)
        .where(and(...conditions))
        .orderBy(desc(recipes.createdAt))
        .limit(input.limit ?? 25);

      return {
        count: rows.length,
        recipes: rows.map((row) => ({
          ...row,
          totalTimeMinutes:
            (row.prepTimeMinutes ?? 0) + (row.cookTimeMinutes ?? 0) || null,
        })),
      };
    },
  });

export const searchRecipesTool = (context: ToolContext) =>
  tool({
    description: "Search household recipes by a free-text query",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search query for recipe title/description"),
      limit: z.number().int().min(1).max(100).optional().describe("Maximum recipes to return"),
    }),
    execute: async (input) => {
      const term = `%${input.query}%`;
      const rows = await context.db
        .select({
          id: recipes.id,
          title: recipes.title,
          tags: recipes.tags,
          prepTimeMinutes: recipes.prepTimeMinutes,
          cookTimeMinutes: recipes.cookTimeMinutes,
          source: recipes.source,
        })
        .from(recipes)
        .where(
          and(
            eq(recipes.householdId, context.householdId),
            or(ilike(recipes.title, term), ilike(recipes.description, term)),
          ),
        )
        .orderBy(desc(recipes.updatedAt))
        .limit(input.limit ?? 25);

      return {
        count: rows.length,
        recipes: rows.map((row) => ({
          ...row,
          totalTimeMinutes:
            (row.prepTimeMinutes ?? 0) + (row.cookTimeMinutes ?? 0) || null,
        })),
      };
    },
  });

export const createRecipeTool = (context: ToolContext) =>
  tool({
    description: "Create a new recipe in the household cookbook",
    inputSchema: z.object({
      title: z.string().describe("Recipe title"),
      description: z.string().optional().describe("Short description"),
      ingredientsJson: z.array(ingredientSchema).optional().describe("Structured ingredient list"),
      instructionsJson: z.array(z.string()).optional().describe("Ordered list of steps"),
      tags: z.array(z.string()).optional().describe("Tags like breakfast, kid-friendly, quick"),
      prepTimeMinutes: z.number().int().min(0).optional().describe("Prep time in minutes"),
      cookTimeMinutes: z.number().int().min(0).optional().describe("Cook time in minutes"),
      yieldServings: z.number().int().min(1).optional().describe("Number of servings"),
      source: z.enum(["photo", "link", "manual", "family"]).optional().describe("Recipe source"),
      notes: z.string().optional().describe("Optional notes"),
      attachmentsJson: z
        .array(recipeAttachmentSchema)
        .optional()
        .describe("Files or images linked to this recipe"),
    }),
    execute: async (input) => {
      const [recipe] = await context.db
        .insert(recipes)
        .values({
          householdId: context.householdId,
          title: input.title,
          description: input.description,
          ingredientsJson: input.ingredientsJson ?? [],
          instructionsJson: input.instructionsJson ?? [],
          tags: input.tags ?? [],
          prepTimeMinutes: input.prepTimeMinutes,
          cookTimeMinutes: input.cookTimeMinutes,
          yieldServings: input.yieldServings,
          source: input.source ?? "manual",
          notes: input.notes,
          attachmentsJson: input.attachmentsJson ?? [],
        })
        .returning();

      if (!recipe) {
        return { success: false, error: "Failed to create recipe" };
      }

      return {
        success: true,
        message: `Created recipe: "${recipe.title}"`,
        recipe: {
          id: recipe.id,
          title: recipe.title,
        },
      };
    },
  });
