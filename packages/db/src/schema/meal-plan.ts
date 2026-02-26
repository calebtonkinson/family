import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  date,
  pgEnum,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { households } from "./household.js";
import { recipes } from "./recipe.js";

/**
 * Meal slot within a day.
 */
export const mealSlotEnum = pgEnum("meal_slot", [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
]);

export type MealPlanExternalLinkJson = {
  url: string;
  title?: string;
};

export const mealPlans = pgTable(
  "meal_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),

    planDate: date("plan_date").notNull(),
    mealSlot: mealSlotEnum("meal_slot").notNull(),

    /** Legacy nullable single recipe reference */
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),

    /** Supports multiple saved recipes for a slot */
    recipeIdsJson: jsonb("recipe_ids_json").$type<string[]>().default([]).notNull(),

    /** Supports multiple external recipe links for a slot */
    externalLinksJson: jsonb("external_links_json")
      .$type<MealPlanExternalLinkJson[]>()
      .default([])
      .notNull(),

    peopleCovered: integer("people_covered"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("meal_plans_household_date_slot_unique").on(
      table.householdId,
      table.planDate,
      table.mealSlot,
    ),
  ],
);

export type MealPlan = typeof mealPlans.$inferSelect;
export type NewMealPlan = typeof mealPlans.$inferInsert;
