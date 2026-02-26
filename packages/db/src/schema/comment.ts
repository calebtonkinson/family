import { pgTable, uuid, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { tasks } from "./task.js";
import { users } from "./user.js";
import { conversations } from "./conversation.js";

export const comments = pgTable("comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  taskId: uuid("task_id")
    .references(() => tasks.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "set null" }),
  content: text("content").notNull(),
  isAiGenerated: boolean("is_ai_generated").default(false).notNull(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
