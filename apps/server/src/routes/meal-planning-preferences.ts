import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { mealPlanningPreferences } from "@home/db/schema";
import { updateMealPlanningPreferencesSchema } from "@home/shared";
import { eq } from "drizzle-orm";

export const mealPlanningPreferencesRouter = new OpenAPIHono();

const mealPlanningPreferenceResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const getMealPlanningPreferencesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Current meal planning preferences",
      content: {
        "application/json": {
          schema: z.object({
            data: mealPlanningPreferenceResponseSchema.nullable(),
          }),
        },
      },
    },
  },
});

mealPlanningPreferencesRouter.openapi(getMealPlanningPreferencesRoute, async (c) => {
  const auth = c.get("auth");

  const [preference] = await db
    .select()
    .from(mealPlanningPreferences)
    .where(eq(mealPlanningPreferences.householdId, auth.householdId))
    .limit(1);

  if (!preference) {
    return c.json({ data: null });
  }

  return c.json({
    data: {
      ...preference,
      createdAt: preference.createdAt.toISOString(),
      updatedAt: preference.updatedAt.toISOString(),
    },
  });
});

const upsertMealPlanningPreferencesRoute = createRoute({
  method: "put",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: updateMealPlanningPreferencesSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Meal planning preferences saved",
      content: {
        "application/json": {
          schema: z.object({
            data: mealPlanningPreferenceResponseSchema,
          }),
        },
      },
    },
  },
});

mealPlanningPreferencesRouter.openapi(upsertMealPlanningPreferencesRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [existing] = await db
    .select()
    .from(mealPlanningPreferences)
    .where(eq(mealPlanningPreferences.householdId, auth.householdId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(mealPlanningPreferences)
      .set({
        notes: body.notes ?? null,
        updatedAt: new Date(),
      })
      .where(eq(mealPlanningPreferences.id, existing.id))
      .returning();

    if (!updated) {
      throw new Error("Failed to update meal planning preferences");
    }

    return c.json({
      data: {
        ...updated,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  }

  const [created] = await db
    .insert(mealPlanningPreferences)
    .values({
      householdId: auth.householdId,
      notes: body.notes ?? null,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create meal planning preferences");
  }

  return c.json({
    data: {
      ...created,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
    },
  });
});
