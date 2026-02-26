import { pgTable, uuid, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { households } from "./household.js";
import { users } from "./user.js";

export const lists = pgTable("lists", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdById: uuid("created_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const listShares = pgTable(
  "list_shares",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listId: uuid("list_id")
      .references(() => lists.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("list_shares_list_user_unique").on(table.listId, table.userId)]
);

export type ListShare = typeof listShares.$inferSelect;
export type NewListShare = typeof listShares.$inferInsert;

export const listItems = pgTable("list_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  listId: uuid("list_id")
    .references(() => lists.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  addedAt: timestamp("added_at").defaultNow().notNull(),
  markedOffAt: timestamp("marked_off_at"),
});

export type List = typeof lists.$inferSelect;
export type NewList = typeof lists.$inferInsert;
export type ListItem = typeof listItems.$inferSelect;
export type NewListItem = typeof listItems.$inferInsert;
