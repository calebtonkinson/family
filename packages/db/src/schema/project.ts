import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { households } from "./household.js";
import { themes } from "./theme.js";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  themeId: uuid("theme_id").references(() => themes.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
