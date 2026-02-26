import { pgTable, uuid, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { users } from "./user.js";
import { lists } from "./list.js";

export const listPins = pgTable(
  "list_pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    listId: uuid("list_id")
      .references(() => lists.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("list_pins_user_list_unique").on(table.userId, table.listId)]
);

export type ListPin = typeof listPins.$inferSelect;
export type NewListPin = typeof listPins.$inferInsert;
