import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { households } from "./household.js";
import { users } from "./user.js";

// AI Providers
export const aiProviderEnum = pgEnum("ai_provider", [
  "anthropic",
  "openai",
  "google",
]);

// Message roles (provider-agnostic)
export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "tool",
  "system",
]);

// Entity types for polymorphic linking
export const entityTypeEnum = pgEnum("entity_type", [
  "theme",
  "project",
  "task",
  "family_member",
]);

// Conversations
export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  startedById: uuid("started_by_id")
    .references(() => users.id, { onDelete: "set null" })
    .notNull(),
  title: text("title"),
  summary: text("summary"),
  provider: aiProviderEnum("provider").notNull(),
  model: text("model").notNull(),
  modelConfig: jsonb("model_config").$type<{
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Conversation messages
export const conversationMessages = pgTable("conversation_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  role: messageRoleEnum("role").notNull(),
  content: text("content"),
  toolCallId: text("tool_call_id"), // For OpenAI tool-role messages
  sequence: integer("sequence").notNull(),
  rawMessage: jsonb("raw_message"), // Original provider response for debugging
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tool calls
export const toolCalls = pgTable("tool_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id")
    .references(() => conversationMessages.id, { onDelete: "cascade" })
    .notNull(),
  toolCallId: text("tool_call_id").notNull(), // Provider's ID or generated
  toolName: text("tool_name").notNull(),
  toolInput: jsonb("tool_input").$type<Record<string, unknown>>().notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tool results
export const toolResults = pgTable("tool_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  toolCallId: text("tool_call_id").notNull(),
  messageId: uuid("message_id").references(() => conversationMessages.id, {
    onDelete: "set null",
  }),
  result: jsonb("result").$type<unknown>().notNull(),
  isError: boolean("is_error").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Polymorphic links from conversations to entities
export const conversationLinks = pgTable("conversation_links", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id")
    .references(() => conversations.id, { onDelete: "cascade" })
    .notNull(),
  entityType: entityTypeEnum("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Push notification subscriptions
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;
export type ToolResult = typeof toolResults.$inferSelect;
export type NewToolResult = typeof toolResults.$inferInsert;
export type ConversationLink = typeof conversationLinks.$inferSelect;
export type NewConversationLink = typeof conversationLinks.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
