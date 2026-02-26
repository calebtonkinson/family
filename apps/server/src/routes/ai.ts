import { OpenAPIHono } from "@hono/zod-openapi";
import { convertToModelMessages, streamText, stepCountIs, type UIMessage } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { db } from "@home/db";
import {
  conversations,
  conversationMessages,
  toolCalls,
  toolResults,
  users,
  familyMembers,
  households,
} from "@home/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { getTools } from "@home/ai";

// Helper to build system prompt with user context
async function buildSystemPrompt(
  householdId: string,
  userId: string,
): Promise<string> {
  // Fetch current user with their family member info
  const [currentUser] = await db
    .select({
      userId: users.id,
      email: users.email,
      userName: users.name,
      familyMemberId: users.familyMemberId,
      firstName: familyMembers.firstName,
      lastName: familyMembers.lastName,
      nickname: familyMembers.nickname,
      birthday: familyMembers.birthday,
      gender: familyMembers.gender,
    })
    .from(users)
    .leftJoin(familyMembers, eq(users.familyMemberId, familyMembers.id))
    .where(eq(users.id, userId))
    .limit(1);

  // Fetch household info
  const [household] = await db
    .select()
    .from(households)
    .where(eq(households.id, householdId))
    .limit(1);

  // Fetch all family members in the household
  const allFamilyMembers = await db
    .select({
      id: familyMembers.id,
      firstName: familyMembers.firstName,
      lastName: familyMembers.lastName,
      nickname: familyMembers.nickname,
      birthday: familyMembers.birthday,
    })
    .from(familyMembers)
    .where(eq(familyMembers.householdId, householdId));

  // Build the current user section
  const displayName =
    currentUser?.nickname ||
    currentUser?.firstName ||
    currentUser?.userName ||
    currentUser?.email ||
    "User";

  let userContext = `## Current User
You are speaking with ${displayName}.`;

  if (currentUser?.firstName) {
    userContext += `\n- Name: ${currentUser.firstName}${currentUser.lastName ? ` ${currentUser.lastName}` : ""}`;
  }
  if (currentUser?.familyMemberId) {
    userContext += `\n- Family Member ID: ${currentUser.familyMemberId} (use this when assigning tasks to "me")`;
  }
  if (currentUser?.nickname && currentUser?.nickname !== displayName) {
    userContext += `\n- Goes by: ${currentUser.nickname}`;
  }
  if (currentUser?.birthday) {
    userContext += `\n- Birthday: ${currentUser.birthday}`;
  }

  // Build the household section
  let householdContext = "";
  if (household) {
    householdContext = `\n\n## Household
Name: ${household.name}`;
  }

  // Build the family members section with IDs for task assignment
  let familyContext = "";
  if (allFamilyMembers.length > 0) {
    familyContext = `\n\n## Family Members (use the ID when assigning tasks)`;
    for (const member of allFamilyMembers) {
      const isCurrentUser = member.id === currentUser?.familyMemberId;
      const memberName = member.nickname || member.firstName;
      familyContext += `\n- ${memberName}${member.lastName ? ` ${member.lastName}` : ""} (ID: ${member.id})${isCurrentUser ? " - current user" : ""}`;
    }
  }

  const today = new Date().toISOString().split("T")[0];

  return `You are a helpful household management assistant.

${userContext}${householdContext}${familyContext}

## Instructions
- Be concise and friendly
- Address the user by their name or nickname when appropriate
- When users ask you to create tasks or projects, use the appropriate tools
- When users ask you to create recipes or share recipe photos, extract ingredients and instructions (separate lists) and use the createRecipe tool
- Do not use task tools for recipe requests
- For meal-planning requests, first call getMealPlanningPreferences, then use recipe tools and bulkUpsertMealPlans
- For "what's for dinner"/"what should we eat" requests, check today's entries with listMealPlans
- When assigning tasks, you can assign them to any family member

## Available tools
- createTask: Create a new task
- listTasks: List tasks with filters
- updateTask: Update a task
- completeTask: Complete a task
- createProject: Create a project
- listProjects: List projects
- listFamilyMembers: List family members
- getFamilyMember: Get family member details
- listThemes: List themes
- createTheme: Create a theme
- createRecipe: Create a recipe (use for any recipe request or recipe image/file)
- listRecipes: List recipes in the household cookbook
- searchRecipes: Search recipes by text
- listMealPlans: List meal plan entries for a date range
- bulkUpsertMealPlans: Create/update meal plan entries in bulk
- getMealPlanningPreferences: Get saved meal-planning philosophy/preferences
- setMealPlanningPreferences: Save meal-planning philosophy/preferences

Today's date is ${today}.`;
}

export const aiRouter = new OpenAPIHono();

const getModel = (provider: string, modelName: string) => {
  switch (provider) {
    case "anthropic":
      return anthropic(modelName);
    case "openai":
      // Use chat completions API (not the new Responses API which has stricter requirements)
      return openai.chat(modelName);
    case "google":
      return google(modelName);
    default:
      return openai.chat("gpt-4o");
  }
};

// Chat endpoint with persistence (streaming)
// Accepts Vercel AI SDK useChat format: { id, messages }
aiRouter.post("/chat/:conversationId", async (c) => {
  const auth = c.get("auth");
  const conversationId = c.req.param("conversationId");

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    return c.json({ error: "Invalid conversation ID" }, 400);
  }

  // AI SDK 6.x sends messages with 'parts' array instead of 'content' string
  interface UIMessagePart {
    type: string;
    text?: string;
    url?: string;
    mediaType?: string;
    filename?: string;
  }
  interface IncomingMessage {
    id?: string;
    role: string;
    content?: string; // Old format
    parts?: UIMessagePart[]; // New AI SDK 6.x format
  }

  const body = await c.req.json<{
    id?: string;
    messages: IncomingMessage[];
  }>();

  const { messages: rawMessages } = body;

  console.log("[AI] Raw request body:", JSON.stringify(body, null, 2));

  if (!rawMessages || rawMessages.length === 0) {
    return c.json({ error: "Messages are required" }, 400);
  }

  const normalizeFileUrl = (url: string) => {
    const match = url.match(/^data:(.+?);base64,(.*)$/);
    if (match) {
      return { mediaType: match[1], data: match[2] };
    }
    return { data: url };
  };

  const normalizeParts = (msg: IncomingMessage): Array<{ type: "text"; text: string } | { type: "file"; url: string; mediaType: string; filename?: string }> => {
    const parts = msg.parts && Array.isArray(msg.parts)
      ? msg.parts
      : msg.content
        ? [{ type: "text", text: msg.content }]
        : [];

    return parts.flatMap(
      (part): Array<{ type: "text"; text: string } | { type: "file"; url: string; mediaType: string; filename?: string }> => {
        if (part.type === "text" && part.text) {
          return [{ type: "text" as const, text: part.text }];
        }
        if (part.type === "file" && part.url && part.mediaType) {
          const normalized = normalizeFileUrl(part.url);
          const url = normalized.data;
          if (!url) return [];
          return [{
            type: "file" as const,
            url,
            mediaType: normalized.mediaType ?? part.mediaType,
            filename: part.filename,
          }];
        }
        return [];
      },
    );
  };

  const summarizeParts = (
    parts: Array<{ type: "text"; text: string } | { type: "file"; url: string; mediaType: string; filename?: string }>,
  ) => {
    const text = parts
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
    const attachments = parts
      .filter((part): part is { type: "file"; url: string; mediaType: string; filename?: string } => part.type === "file")
      .map((part) => `Attachment: ${part.filename || part.mediaType}`)
      .join("\n");

    return [text, attachments].filter((value) => value && value.trim()).join("\n\n");
  };

  const normalizedMessages: Array<Omit<UIMessage, "id">> = rawMessages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      parts: normalizeParts(msg),
    }))
    .filter((msg) => msg.parts.length > 0);

  // Get conversation
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.householdId, auth.householdId),
      ),
    )
    .limit(1);

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  // Get the last user message from incoming messages
  const lastUserMessage = [...rawMessages]
    .reverse()
    .find((m) => m.role === "user");

  if (!lastUserMessage) {
    return c.json({ error: "No user message found" }, 400);
  }

  // Get existing messages from DB
  const existingDbMessages = await db
    .select()
    .from(conversationMessages)
    .where(eq(conversationMessages.conversationId, conversationId))
    .orderBy(asc(conversationMessages.sequence));

  // Get next sequence number
  const nextSequence =
    existingDbMessages.length > 0
      ? Math.max(...existingDbMessages.map((m) => m.sequence)) + 1
      : 1;

  // Save user message to DB
  const lastUserParts = lastUserMessage ? normalizeParts(lastUserMessage) : [];
  const lastUserContent = summarizeParts(lastUserParts);

  const hasFilePart = lastUserParts.some((part) => part.type === "file");

  await db.insert(conversationMessages).values({
    conversationId,
    role: "user",
    content: lastUserContent || null,
    sequence: nextSequence,
    rawMessage: !hasFilePart && lastUserParts.length > 0 ? { role: "user", parts: lastUserParts } : null,
  });

  // Get tools
  const tools = getTools({
    householdId: auth.householdId,
    userId: auth.userId,
    db,
  });

  const model = getModel(conversation.provider, conversation.model);

  // Build system prompt with user context
  const systemPrompt = await buildSystemPrompt(auth.householdId, auth.userId);

  const modelMessages = await convertToModelMessages(normalizedMessages, { tools });

  const logMessages = normalizedMessages.map((message) => ({
    role: message.role,
    parts: message.parts.map((part) => {
      if (part.type === "text") {
        return { type: "text" as const, length: part.text.length };
      }
      if (part.type === "file") {
        return {
          type: "file" as const,
          mediaType: part.mediaType,
          filename: part.filename,
        };
      }
      return { type: "text" as const, length: 0 };
    }),
  }));

  console.log(
    "[AI] Starting streamText with",
    modelMessages.length,
    "messages",
  );
  console.log("[AI] Messages:", JSON.stringify(logMessages, null, 2));
  console.log("[AI] Tools available:", Object.keys(tools));

  const toolCallOrder: string[] = [];
  const toolCallsById = new Map<
    string,
    { toolCallId: string; toolName: string; toolInput: Record<string, unknown> }
  >();
  const toolResultsById = new Map<
    string,
    { toolCallId: string; result: unknown; isError: boolean }
  >();

  const normalizeToolInput = (input: unknown): Record<string, unknown> => {
    if (input && typeof input === "object" && !Array.isArray(input)) {
      return input as Record<string, unknown>;
    }
    if (input === undefined) {
      return {};
    }
    return { value: input };
  };

  const recordToolCall = (
    toolCallId: string | undefined,
    toolName: string | undefined,
    input: unknown,
  ) => {
    if (!toolCallId) return;
    const existing = toolCallsById.get(toolCallId);
    const normalizedInput = normalizeToolInput(input);
    if (existing) {
      const nextName = toolName ?? existing.toolName;
      const nextInput =
        Object.keys(existing.toolInput).length > 0
          ? existing.toolInput
          : normalizedInput;
      if (nextName !== existing.toolName || nextInput !== existing.toolInput) {
        toolCallsById.set(toolCallId, {
          toolCallId,
          toolName: nextName,
          toolInput: nextInput,
        });
      }
      return;
    }
    toolCallsById.set(toolCallId, {
      toolCallId,
      toolName: toolName ?? "tool",
      toolInput: normalizedInput,
    });
    toolCallOrder.push(toolCallId);
  };

  const recordToolResult = (
    toolCallId: string | undefined,
    result: unknown,
    isError: boolean,
  ) => {
    if (!toolCallId) return;
    const existing = toolResultsById.get(toolCallId);
    if (!existing || (existing.isError && !isError)) {
      toolResultsById.set(toolCallId, { toolCallId, result, isError });
    }
  };

  const captureToolingFromContent = (content: Array<unknown>) => {
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const toolPart = part as {
        type?: string;
        toolCallId?: string;
        toolName?: string;
        input?: unknown;
        output?: unknown;
        error?: unknown;
        preliminary?: boolean;
      };

      if (toolPart.type === "tool-call") {
        recordToolCall(toolPart.toolCallId, toolPart.toolName, toolPart.input);
        continue;
      }

      if (toolPart.type === "tool-result") {
        recordToolCall(toolPart.toolCallId, toolPart.toolName, toolPart.input);
        if (!toolPart.preliminary) {
          recordToolResult(toolPart.toolCallId, toolPart.output, false);
        }
        continue;
      }

      if (toolPart.type === "tool-error") {
        recordToolCall(toolPart.toolCallId, toolPart.toolName, toolPart.input);
        recordToolResult(toolPart.toolCallId, toolPart.error, true);
      }
    }
  };

  const result = streamText({
    model,
    messages: modelMessages,
    tools,
    system: systemPrompt,
    stopWhen: stepCountIs(5), // Allow up to 5 tool call steps before final response

    onStepFinish: (stepResult) => {
      captureToolingFromContent(stepResult.content as Array<unknown>);
      console.log(
        "[AI onStepFinish] finishReason:",
        stepResult.finishReason,
        "text:",
        stepResult.text?.slice(0, 50) || "(empty)",
        "toolCalls:",
        stepResult.toolCalls?.length || 0,
      );
    },
    onFinish: async ({
      text,
      toolCalls: resultToolCalls,
      toolResults: resultToolResults,
      finishReason,
      usage,
      ...rest
    }) => {
      captureToolingFromContent(rest.content as Array<unknown>);
      console.log("[AI onFinish] rest:", JSON.stringify(rest));
      console.log("[AI onFinish] finishReason:", finishReason);
      console.log("[AI onFinish] usage:", JSON.stringify(usage));
      console.log("[AI onFinish] text:", text?.slice(0, 100) || "(empty)");
      console.log("[AI onFinish] toolCalls:", resultToolCalls?.length || 0);
      console.log("[AI onFinish] toolResults:", resultToolResults?.length || 0);

      // Save assistant message
      const [assistantMessage] = await db
        .insert(conversationMessages)
        .values({
          conversationId,
          role: "assistant",
          content: text,
          sequence: nextSequence + 1,
        })
        .returning();

      if (!assistantMessage) {
        console.error("Failed to save assistant message");
        return;
      }

      // Save tool calls if any
      const persistedToolCalls = toolCallOrder
        .map((toolCallId) => toolCallsById.get(toolCallId))
        .filter(
          (toolCall): toolCall is {
            toolCallId: string;
            toolName: string;
            toolInput: Record<string, unknown>;
          } => Boolean(toolCall),
        );

      if (persistedToolCalls.length > 0) {
        for (let i = 0; i < persistedToolCalls.length; i++) {
          const tc = persistedToolCalls[i];
          if (!tc) continue;
          await db.insert(toolCalls).values({
            messageId: assistantMessage.id,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            toolInput: tc.toolInput,
            sequence: i,
          });
        }
      }

      // Save tool results if any
      if (toolResultsById.size > 0) {
        for (const tr of toolResultsById.values()) {
          await db.insert(toolResults).values({
            conversationId,
            toolCallId: tr.toolCallId,
            messageId: assistantMessage.id,
            result: tr.result,
            isError: tr.isError,
          });
        }
      }

      // Update conversation timestamp and generate title if first message
      const updateData: { updatedAt: Date; title?: string } = {
        updatedAt: new Date(),
      };

      // Auto-generate title from first user message if not set.
      // Prefer parsed user text (works with parts-based messages) and avoid attachment-only titles.
      if (!conversation.title && lastUserContent) {
        const titleSource = lastUserContent
          .split("\n")
          .map((line) => line.trim())
          .find((line) => line.length > 0 && !line.startsWith("Attachment:"));

        if (titleSource) {
          const title = titleSource.slice(0, 50);
          updateData.title =
            title.length < titleSource.length ? `${title}...` : title;
        }
      }

      await db
        .update(conversations)
        .set(updateData)
        .where(eq(conversations.id, conversationId));
    },
  });

  // Use toUIMessageStreamResponse for compatibility with AI SDK 6.x @ai-sdk/react
  return result.toUIMessageStreamResponse();
});

// Simple chat (streaming, no conversation persistence)
// Using regular route instead of OpenAPI as it doesn't handle streams well
// Accepts Vercel AI SDK useChat format: { id, messages }
aiRouter.post("/chat", async (c) => {
  const auth = c.get("auth");
  const body = await c.req.json<{
    id?: string;
    messages: Array<{ role: string; content: string }>;
    provider?: string;
    model?: string;
  }>();
  const { messages, provider = "openai", model = "gpt-4o" } = body;

  if (!messages || messages.length === 0) {
    return c.json({ error: "Messages are required" }, 400);
  }

  // Filter to only user/assistant messages and ensure content exists
  const formattedMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content || "",
    }));

  if (formattedMessages.length === 0) {
    return c.json({ error: "At least one user message is required" }, 400);
  }

  const tools = getTools({
    householdId: auth.householdId,
    userId: auth.userId,
    db,
  });

  const aiModel = getModel(provider, model);

  // Build system prompt with user context
  const systemPrompt = await buildSystemPrompt(auth.householdId, auth.userId);

  const result = streamText({
    model: aiModel,
    messages: formattedMessages,
    tools,
    system: systemPrompt,
    stopWhen: stepCountIs(5), // Allow up to 5 tool call steps before final response

    onStepFinish: (stepResult) => {
      console.log(
        "[Simple Chat onStepFinish]",
        stepResult.finishReason,
        "toolCalls:",
        stepResult.toolCalls?.length,
      );
    },
    onFinish: ({ text, toolCalls, finishReason }) => {
      console.log(
        "[Simple Chat onFinish]",
        finishReason,
        "text:",
        text?.slice(0, 50) || "(empty)",
        "toolCalls:",
        toolCalls?.length,
      );
    },
  });

  // Use toUIMessageStreamResponse for compatibility with AI SDK 6.x @ai-sdk/react
  return result.toUIMessageStreamResponse();
});
