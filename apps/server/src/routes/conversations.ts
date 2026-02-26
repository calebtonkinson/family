import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import {
  conversations,
  conversationMessages,
  conversationLinks,
  toolCalls,
  toolResults,
} from "@home/db/schema";
import {
  createConversationSchema,
  linkConversationSchema,
  idParamSchema,
  paginationSchema,
} from "@home/shared";
import { eq, and, desc, asc, sql, inArray } from "drizzle-orm";

export const conversationsRouter = new OpenAPIHono();

const conversationResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  startedById: z.string().uuid(),
  title: z.string().nullable(),
  summary: z.string().nullable(),
  provider: z.enum(["anthropic", "openai", "google"]),
  model: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  messageCount: z.number().optional(),
});

const messageResponseSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  role: z.enum(["user", "assistant", "tool", "system"]),
  content: z.string().nullable(),
  toolCallId: z.string().nullable(),
  sequence: z.number(),
  rawMessage: z.record(z.unknown()).nullable().optional(),
  createdAt: z.string(),
});

// List conversations
const listConversationsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: paginationSchema,
  },
  responses: {
    200: {
      description: "List of conversations",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(conversationResponseSchema),
            meta: z.object({
              page: z.number(),
              limit: z.number(),
              total: z.number(),
              totalPages: z.number(),
            }),
          }),
        },
      },
    },
  },
});

conversationsRouter.openapi(listConversationsRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;

  const [conversationsList, countResult] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(eq(conversations.householdId, auth.householdId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(eq(conversations.householdId, auth.householdId)),
  ]);

  // Get message counts
  const conversationIds = conversationsList.map((c) => c.id);
  const messageCounts = conversationIds.length > 0
    ? await db
        .select({
          conversationId: conversationMessages.conversationId,
          count: sql<number>`count(*)`,
        })
        .from(conversationMessages)
        .where(inArray(conversationMessages.conversationId, conversationIds))
        .groupBy(conversationMessages.conversationId)
    : [];

  const messageCountMap = new Map(messageCounts.map((mc) => [mc.conversationId, Number(mc.count)]));

  const total = Number(countResult[0]?.count ?? 0);

  const data = conversationsList.map((conv) => ({
    ...conv,
    createdAt: conv.createdAt.toISOString(),
    updatedAt: conv.updatedAt.toISOString(),
    messageCount: messageCountMap.get(conv.id) || 0,
  }));

  return c.json({
    data,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// Get single conversation with messages
const getConversationRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Conversation with messages",
      content: {
        "application/json": {
          schema: z.object({
            data: conversationResponseSchema.extend({
              messages: z.array(messageResponseSchema),
              links: z.array(
                z.object({
                  id: z.string().uuid(),
                  entityType: z.enum(["theme", "project", "task", "family_member"]),
                  entityId: z.string().uuid(),
                  createdAt: z.string(),
                })
              ),
            }),
          }),
        },
      },
    },
    404: {
      description: "Conversation not found",
    },
  },
});

conversationsRouter.openapi(getConversationRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.householdId, auth.householdId)))
    .limit(1);

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [messages, links, allToolResults] = await Promise.all([
    db
      .select()
      .from(conversationMessages)
      .where(eq(conversationMessages.conversationId, id))
      .orderBy(asc(conversationMessages.sequence)),
    db
      .select()
      .from(conversationLinks)
      .where(eq(conversationLinks.conversationId, id)),
    db
      .select()
      .from(toolResults)
      .where(eq(toolResults.conversationId, id)),
  ]);

  // Get message IDs to fetch tool calls
  const messageIds = messages.map((m) => m.id);
  const allToolCalls = messageIds.length > 0 
    ? await db
        .select()
        .from(toolCalls)
        .where(inArray(toolCalls.messageId, messageIds))
        .orderBy(asc(toolCalls.sequence))
    : [];

  // Group tool calls by message ID
  const toolCallsByMessageId: Record<string, Array<{
    id: string;
    toolCallId: string;
    toolName: string;
    toolInput: Record<string, unknown>;
    sequence: number;
    createdAt: string;
  }>> = {};
  
  for (const tc of allToolCalls) {
    if (!toolCallsByMessageId[tc.messageId]) {
      toolCallsByMessageId[tc.messageId] = [];
    }
    toolCallsByMessageId[tc.messageId]!.push({
      id: tc.id,
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      toolInput: tc.toolInput,
      sequence: tc.sequence,
      createdAt: tc.createdAt.toISOString(),
    });
  }

  // Create a map of tool results by toolCallId
  const toolResultsByCallId = allToolResults.reduce((acc, tr) => {
    acc[tr.toolCallId] = {
      id: tr.id,
      result: tr.result,
      isError: tr.isError,
      createdAt: tr.createdAt.toISOString(),
    };
    return acc;
  }, {} as Record<string, {
    id: string;
    result: unknown;
    isError: boolean | null;
    createdAt: string;
  }>);

  return c.json({
    data: {
      ...conversation,
      createdAt: conversation.createdAt.toISOString(),
      updatedAt: conversation.updatedAt.toISOString(),
      messages: messages.map((m) => ({
        ...m,
        createdAt: m.createdAt.toISOString(),
        toolCalls: toolCallsByMessageId[m.id] || [],
      })),
      links: links.map((l) => ({
        ...l,
        createdAt: l.createdAt.toISOString(),
      })),
      toolResults: toolResultsByCallId,
    },
  });
});

// Create conversation
const createConversationRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createConversationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Conversation created",
      content: {
        "application/json": {
          schema: z.object({ data: conversationResponseSchema }),
        },
      },
    },
  },
});

conversationsRouter.openapi(createConversationRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [conversation] = await db
    .insert(conversations)
    .values({
      householdId: auth.householdId,
      startedById: auth.userId,
      title: body.title,
      provider: body.provider,
      model: body.model,
    })
    .returning();

  if (!conversation) {
    throw new Error("Failed to create conversation");
  }

  return c.json(
    {
      data: {
        id: conversation.id,
        householdId: conversation.householdId,
        startedById: conversation.startedById,
        title: conversation.title,
        summary: conversation.summary,
        provider: conversation.provider,
        model: conversation.model,
        createdAt: conversation.createdAt.toISOString(),
        updatedAt: conversation.updatedAt.toISOString(),
        messageCount: 0,
      },
    },
    201
  );
});

// Link conversation to entity
const linkConversationRoute = createRoute({
  method: "post",
  path: "/:id/link",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: linkConversationSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Link created",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              id: z.string().uuid(),
              conversationId: z.string().uuid(),
              entityType: z.enum(["theme", "project", "task", "family_member"]),
              entityId: z.string().uuid(),
              createdAt: z.string(),
            }),
          }),
        },
      },
    },
    404: {
      description: "Conversation not found",
    },
  },
});

conversationsRouter.openapi(linkConversationRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  // Verify conversation belongs to household
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.householdId, auth.householdId)))
    .limit(1);

  if (!conversation) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  const [link] = await db
    .insert(conversationLinks)
    .values({
      conversationId: id,
      entityType: body.entityType,
      entityId: body.entityId,
    })
    .returning();

  if (!link) {
    throw new Error("Failed to create link");
  }

  return c.json(
    {
      data: {
        id: link.id,
        conversationId: link.conversationId,
        entityType: link.entityType,
        entityId: link.entityId,
        createdAt: link.createdAt.toISOString(),
      },
    },
    201
  );
});

// Delete conversation
const deleteConversationRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Conversation deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Conversation not found",
    },
  },
});

conversationsRouter.openapi(deleteConversationRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Conversation not found" }, 404);
  }

  return c.json({ success: true });
});
