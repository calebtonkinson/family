import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { households } from "./household.js";

/**
 * How the recipe was created/sourced.
 */
export const recipeSourceEnum = pgEnum("recipe_source", [
  "photo",
  "link",
  "manual",
  "family",
]);

/**
 * Ingredient structure: name, quantity, unit, qualifiers (e.g., "chopped", "low-sodium")
 */
export type IngredientJson = {
  name: string;
  quantity?: string | number;
  unit?: string;
  qualifiers?: string;
};

export type RecipeAttachmentJson = {
  url: string;
  mediaType: string;
  filename?: string;
};

export const recipes = pgTable("recipes", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),

  title: text("title").notNull(),
  description: text("description"),

  /** Structured list: { name, quantity, unit, qualifiers }[] */
  ingredientsJson: jsonb("ingredients_json")
    .$type<IngredientJson[]>()
    .default([])
    .notNull(),

  /** Simple ordered list of instruction strings */
  instructionsJson: jsonb("instructions_json")
    .$type<string[]>()
    .default([])
    .notNull(),

  /** Tags: e.g., breakfast, kid-friendly, quick */
  tags: jsonb("tags").$type<string[]>().default([]).notNull(),

  prepTimeMinutes: integer("prep_time_minutes"),
  cookTimeMinutes: integer("cook_time_minutes"),
  yieldServings: integer("yield_servings"),

  source: recipeSourceEnum("source").default("manual").notNull(),
  notes: text("notes"),
  attachmentsJson: jsonb("attachments_json")
    .$type<RecipeAttachmentJson[]>()
    .default([])
    .notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Recipe = typeof recipes.$inferSelect;
export type NewRecipe = typeof recipes.$inferInsert;
