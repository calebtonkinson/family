import { tool } from "ai";
import { z } from "zod";
import { mealPlans, mealPlanningPreferences, recipes } from "@home/db/schema";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import type { ToolContext } from "../types.js";

const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner", "snacks"]);

const externalLinkSchema = z.object({
  url: z.string().min(1).describe("External recipe URL"),
  title: z.string().optional().describe("Optional title for the link"),
});

const normalizeRecipeIds = (value: unknown, fallbackRecipeId?: string | null) => {
  const set = new Set<string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && item.trim()) {
        set.add(item);
      }
    }
  }
  if (fallbackRecipeId) {
    set.add(fallbackRecipeId);
  }
  return Array.from(set);
};

const normalizeExternalLinks = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is { url: string; title?: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { url?: string }).url === "string",
    )
    .map((item) => ({
      url: item.url.trim(),
      title:
        typeof item.title === "string" && item.title.trim()
          ? item.title.trim()
          : undefined,
    }))
    .filter((item) => item.url.length > 0);
};

export const listMealPlansTool = (context: ToolContext) =>
  tool({
    description: "List meal plan entries for a date range",
    inputSchema: z.object({
      startDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Inclusive start date, YYYY-MM-DD"),
      endDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional()
        .describe("Inclusive end date, YYYY-MM-DD"),
      mealSlot: mealSlotSchema.optional().describe("Optional meal slot filter"),
    }),
    execute: async (input) => {
      const conditions = [eq(mealPlans.householdId, context.householdId)];
      if (input.startDate) {
        conditions.push(gte(mealPlans.planDate, input.startDate));
      }
      if (input.endDate) {
        conditions.push(lte(mealPlans.planDate, input.endDate));
      }
      if (input.mealSlot) {
        conditions.push(eq(mealPlans.mealSlot, input.mealSlot));
      }

      const rows = await context.db
        .select()
        .from(mealPlans)
        .where(and(...conditions))
        .orderBy(asc(mealPlans.planDate), asc(mealPlans.mealSlot));

      const recipeIds = Array.from(
        new Set(
          rows.flatMap((row) =>
            normalizeRecipeIds(row.recipeIdsJson, row.recipeId),
          ),
        ),
      );

      const recipeRows =
        recipeIds.length > 0
          ? await context.db
              .select({
                id: recipes.id,
                title: recipes.title,
              })
              .from(recipes)
              .where(
                and(
                  eq(recipes.householdId, context.householdId),
                  inArray(recipes.id, recipeIds),
                ),
              )
          : [];

      const recipeMap = new Map(recipeRows.map((row) => [row.id, row]));

      return {
        count: rows.length,
        plans: rows.map((row) => {
          const normalizedRecipeIds = normalizeRecipeIds(row.recipeIdsJson, row.recipeId);
          return {
            id: row.id,
            planDate: String(row.planDate),
            mealSlot: row.mealSlot,
            notes: row.notes,
            peopleCovered: row.peopleCovered,
            recipeIdsJson: normalizedRecipeIds,
            externalLinksJson: normalizeExternalLinks(row.externalLinksJson),
            recipes: normalizedRecipeIds
              .map((id) => recipeMap.get(id))
              .filter((recipe): recipe is { id: string; title: string } => Boolean(recipe)),
          };
        }),
      };
    },
  });

export const bulkUpsertMealPlansTool = (context: ToolContext) =>
  tool({
    description:
      "Create or update meal plan entries in bulk for one or more days and meal slots",
    inputSchema: z.object({
      entries: z
        .array(
          z.object({
            planDate: z
              .string()
              .regex(/^\d{4}-\d{2}-\d{2}$/)
              .describe("Date in YYYY-MM-DD"),
            mealSlot: mealSlotSchema.describe("Meal slot"),
            recipeIdsJson: z
              .array(z.string().uuid())
              .optional()
              .describe("Saved recipe IDs for the slot"),
            externalLinksJson: z
              .array(externalLinkSchema)
              .optional()
              .describe("External recipe links for the slot"),
            notes: z
              .string()
              .optional()
              .describe("Free text for what to cook, leftovers, etc."),
            peopleCovered: z.number().int().min(1).max(50).optional(),
          }),
        )
        .min(1)
        .max(200),
    }),
    execute: async (input) => {
      let created = 0;
      let updated = 0;

      for (const entry of input.entries) {
        const recipeIdsJson = normalizeRecipeIds(entry.recipeIdsJson);
        const externalLinksJson = normalizeExternalLinks(entry.externalLinksJson);
        const [existing] = await context.db
          .select({ id: mealPlans.id })
          .from(mealPlans)
          .where(
            and(
              eq(mealPlans.householdId, context.householdId),
              eq(mealPlans.planDate, entry.planDate),
              eq(mealPlans.mealSlot, entry.mealSlot),
            ),
          )
          .limit(1);

        if (existing) {
          await context.db
            .update(mealPlans)
            .set({
              recipeId: recipeIdsJson[0] ?? null,
              recipeIdsJson,
              externalLinksJson,
              notes: entry.notes ?? null,
              peopleCovered: entry.peopleCovered ?? null,
              updatedAt: new Date(),
            })
            .where(eq(mealPlans.id, existing.id));
          updated += 1;
          continue;
        }

        await context.db.insert(mealPlans).values({
          householdId: context.householdId,
          planDate: entry.planDate,
          mealSlot: entry.mealSlot,
          recipeId: recipeIdsJson[0] ?? null,
          recipeIdsJson,
          externalLinksJson,
          notes: entry.notes ?? null,
          peopleCovered: entry.peopleCovered ?? null,
        });
        created += 1;
      }

      return {
        success: true,
        created,
        updated,
        total: input.entries.length,
      };
    },
  });

export const getMealPlanningPreferencesTool = (context: ToolContext) =>
  tool({
    description:
      "Get household meal-planning philosophy/preferences to use as planning baseline",
    inputSchema: z.object({}),
    execute: async () => {
      const [preferences] = await context.db
        .select()
        .from(mealPlanningPreferences)
        .where(eq(mealPlanningPreferences.householdId, context.householdId))
        .limit(1);

      return {
        hasPreferences: Boolean(preferences),
        notes: preferences?.notes ?? null,
      };
    },
  });

export const setMealPlanningPreferencesTool = (context: ToolContext) =>
  tool({
    description:
      "Set or update household meal-planning philosophy/preferences for future planning",
    inputSchema: z.object({
      notes: z
        .string()
        .min(1)
        .max(20000)
        .describe("Meal planning preferences/philosophy text"),
    }),
    execute: async (input) => {
      const [existing] = await context.db
        .select()
        .from(mealPlanningPreferences)
        .where(eq(mealPlanningPreferences.householdId, context.householdId))
        .limit(1);

      if (existing) {
        await context.db
          .update(mealPlanningPreferences)
          .set({
            notes: input.notes,
            updatedAt: new Date(),
          })
          .where(eq(mealPlanningPreferences.id, existing.id));
      } else {
        await context.db.insert(mealPlanningPreferences).values({
          householdId: context.householdId,
          notes: input.notes,
        });
      }

      return {
        success: true,
        message: "Meal planning preferences saved",
      };
    },
  });
