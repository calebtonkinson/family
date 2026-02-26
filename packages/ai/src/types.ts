import type { Database } from "@home/db";

export interface ToolContext {
  householdId: string;
  userId: string;
  db: Database;
}

export type AIProvider = "anthropic" | "openai" | "google";

export interface AIMessage {
  role: "user" | "assistant" | "tool" | "system";
  content: string | null;
  toolCallId?: string;
  toolCalls?: AIToolCall[];
  toolResults?: AIToolResult[];
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  result: unknown;
  isError?: boolean;
}
