import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { mealPlans, recipes } from "@home/db/schema";
import {
  bulkUpsertMealPlansSchema,
  idParamSchema,
  mealPlanFilterSchema,
  updateMealPlanSchema,
} from "@home/shared";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";

export const mealPlansRouter = new OpenAPIHono();

const externalLinkResponseSchema = z.object({
  url: z.string(),
  title: z.string().optional(),
});

const recipeSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
});

const mealPlanResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  planDate: z.string(),
  mealSlot: z.enum(["breakfast", "lunch", "dinner", "snacks"]),
  recipeId: z.string().uuid().nullable(),
  recipeIdsJson: z.array(z.string().uuid()),
  externalLinksJson: z.array(externalLinkResponseSchema),
  peopleCovered: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  recipes: z.array(recipeSummarySchema),
});

const normalizePlanDate = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
};

const normalizeRecipeIds = (value: unknown, fallbackRecipeId: string | null) => {
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

// List meal plans
const listMealPlansRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: mealPlanFilterSchema,
  },
  responses: {
    200: {
      description: "List meal plans",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(mealPlanResponseSchema),
          }),
        },
      },
    },
  },
});

mealPlansRouter.openapi(listMealPlansRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const conditions = [eq(mealPlans.householdId, auth.householdId)];
  if (query.startDate) {
    conditions.push(gte(mealPlans.planDate, query.startDate));
  }
  if (query.endDate) {
    conditions.push(lte(mealPlans.planDate, query.endDate));
  }
  if (query.mealSlot) {
    conditions.push(eq(mealPlans.mealSlot, query.mealSlot));
  }

  const plans = await db
    .select()
    .from(mealPlans)
    .where(and(...conditions))
    .orderBy(asc(mealPlans.planDate), asc(mealPlans.mealSlot), asc(mealPlans.createdAt));

  const recipeIds = Array.from(
    new Set(
      plans.flatMap((plan) =>
        normalizeRecipeIds(plan.recipeIdsJson, plan.recipeId),
      ),
    ),
  );

  const recipeRows =
    recipeIds.length > 0
      ? await db
          .select({
            id: recipes.id,
            title: recipes.title,
          })
          .from(recipes)
          .where(and(eq(recipes.householdId, auth.householdId), inArray(recipes.id, recipeIds)))
      : [];

  const recipeMap = new Map(recipeRows.map((recipe) => [recipe.id, recipe]));

  return c.json({
    data: plans.map((plan) => {
      const normalizedRecipeIds = normalizeRecipeIds(plan.recipeIdsJson, plan.recipeId);
      return {
        ...plan,
        planDate: normalizePlanDate(plan.planDate),
        recipeIdsJson: normalizedRecipeIds,
        externalLinksJson: normalizeExternalLinks(plan.externalLinksJson),
        createdAt: plan.createdAt.toISOString(),
        updatedAt: plan.updatedAt.toISOString(),
        recipes: normalizedRecipeIds
          .map((id) => recipeMap.get(id))
          .filter((recipe): recipe is { id: string; title: string } => Boolean(recipe)),
      };
    }),
  });
});

// Bulk upsert meal plans
const bulkUpsertMealPlansRoute = createRoute({
  method: "put",
  path: "/bulk",
  request: {
    body: {
      content: {
        "application/json": {
          schema: bulkUpsertMealPlansSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Bulk upserted meal plans",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              created: z.number(),
              updated: z.number(),
              total: z.number(),
            }),
          }),
        },
      },
    },
  },
});

mealPlansRouter.openapi(bulkUpsertMealPlansRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");
  let created = 0;
  let updated = 0;

  for (const entry of body.entries) {
    const recipeIdsJson = normalizeRecipeIds(entry.recipeIdsJson, null);
    const externalLinksJson = normalizeExternalLinks(entry.externalLinksJson);
    const [existing] = await db
      .select({ id: mealPlans.id })
      .from(mealPlans)
      .where(
        and(
          eq(mealPlans.householdId, auth.householdId),
          eq(mealPlans.planDate, entry.planDate),
          eq(mealPlans.mealSlot, entry.mealSlot),
        ),
      )
      .limit(1);

    if (existing) {
      await db
        .update(mealPlans)
        .set({
          recipeId: recipeIdsJson[0] ?? null,
          recipeIdsJson,
          externalLinksJson,
          peopleCovered: entry.peopleCovered ?? null,
          notes: entry.notes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(mealPlans.id, existing.id));
      updated += 1;
      continue;
    }

    await db.insert(mealPlans).values({
      householdId: auth.householdId,
      planDate: entry.planDate,
      mealSlot: entry.mealSlot,
      recipeId: recipeIdsJson[0] ?? null,
      recipeIdsJson,
      externalLinksJson,
      peopleCovered: entry.peopleCovered ?? null,
      notes: entry.notes ?? null,
    });
    created += 1;
  }

  return c.json({
    data: {
      created,
      updated,
      total: body.entries.length,
    },
  });
});

// Update meal plan
const updateMealPlanRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateMealPlanSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Meal plan updated",
      content: {
        "application/json": {
          schema: z.object({ data: mealPlanResponseSchema }),
        },
      },
    },
    404: {
      description: "Meal plan not found",
    },
  },
});

mealPlansRouter.openapi(updateMealPlanRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (body.recipeIdsJson !== undefined) {
    const recipeIdsJson = normalizeRecipeIds(body.recipeIdsJson, null);
    updateData.recipeIdsJson = recipeIdsJson;
    updateData.recipeId = recipeIdsJson[0] ?? null;
  }
  if (body.externalLinksJson !== undefined) {
    updateData.externalLinksJson = normalizeExternalLinks(body.externalLinksJson);
  }
  if (body.peopleCovered !== undefined) {
    updateData.peopleCovered = body.peopleCovered;
  }
  if (body.notes !== undefined) {
    updateData.notes = body.notes;
  }

  const [plan] = await db
    .update(mealPlans)
    .set(updateData)
    .where(and(eq(mealPlans.id, id), eq(mealPlans.householdId, auth.householdId)))
    .returning();

  if (!plan) {
    return c.json({ error: "Meal plan not found" }, 404);
  }

  const recipeIdsJson = normalizeRecipeIds(plan.recipeIdsJson, plan.recipeId);
  const recipeRows =
    recipeIdsJson.length > 0
      ? await db
          .select({
            id: recipes.id,
            title: recipes.title,
          })
          .from(recipes)
          .where(and(eq(recipes.householdId, auth.householdId), inArray(recipes.id, recipeIdsJson)))
      : [];

  return c.json({
    data: {
      ...plan,
      planDate: normalizePlanDate(plan.planDate),
      recipeIdsJson,
      externalLinksJson: normalizeExternalLinks(plan.externalLinksJson),
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
      recipes: recipeRows,
    },
  });
});

// Delete meal plan
const deleteMealPlanRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Meal plan deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Meal plan not found",
    },
  },
});

mealPlansRouter.openapi(deleteMealPlanRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const deleted = await db
    .delete(mealPlans)
    .where(and(eq(mealPlans.id, id), eq(mealPlans.householdId, auth.householdId)))
    .returning({ id: mealPlans.id });

  if (deleted.length === 0) {
    return c.json({ error: "Meal plan not found" }, 404);
  }

  return c.json({ success: true });
});
