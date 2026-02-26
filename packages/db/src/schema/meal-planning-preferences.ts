import { pgTable, uuid, text, timestamp } from "drizzle-orm/pg-core";
import { households } from "./household.js";

/**
 * Household meal planning preferences. One row per household.
 * Notes are consumed by the AI assistant when planning meals.
 */
export const mealPlanningPreferences = pgTable("meal_planning_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull()
    .unique(),

  /** Preference notes for the model when planning (e.g., dietary restrictions, favorites) */
  notes: text("notes"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type MealPlanningPreference =
  typeof mealPlanningPreferences.$inferSelect;
export type NewMealPlanningPreference =
  typeof mealPlanningPreferences.$inferInsert;
