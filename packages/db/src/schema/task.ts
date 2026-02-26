import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";
import { households } from "./household.js";
import { themes } from "./theme.js";
import { projects } from "./project.js";
import { users } from "./user.js";
import { familyMembers } from "./family-member.js";

export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "in_progress",
  "done",
  "archived",
]);

export const recurrenceTypeEnum = pgEnum("recurrence_type", [
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "custom_days",
]);

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  themeId: uuid("theme_id").references(() => themes.id, {
    onDelete: "set null",
  }),
  projectId: uuid("project_id").references(() => projects.id, {
    onDelete: "set null",
  }),

  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").default("todo").notNull(),

  // Assignment - references family_members so kids can be assigned tasks
  assignedToId: uuid("assigned_to_id").references(() => familyMembers.id, {
    onDelete: "set null",
  }),
  // Created by - references users (must be a logged-in user)
  createdById: uuid("created_by_id")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),

  dueDate: timestamp("due_date"),

  isRecurring: boolean("is_recurring").default(false),
  recurrenceType: recurrenceTypeEnum("recurrence_type"),
  recurrenceInterval: integer("recurrence_interval"),
  nextDueDate: timestamp("next_due_date"),
  lastCompletedAt: timestamp("last_completed_at"),

  priority: integer("priority").default(0), // 0 = normal, 1 = high, 2 = urgent

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
