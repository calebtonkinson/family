import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { lists, listItems, listPins, listShares } from "@home/db/schema";
import {
  createListSchema,
  updateListSchema,
  updateListSharesSchema,
  listFilterSchema,
  createListItemSchema,
  updateListItemSchema,
  reorderPinsSchema,
  idParamSchema,
  listIdItemIdParamSchema,
  paginationSchema,
} from "@home/shared";
import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

export const listsRouter = new OpenAPIHono();

function listAccessCondition(userId: string) {
  return or(
    isNull(lists.createdById),
    eq(lists.createdById, userId),
    sql`EXISTS (SELECT 1 FROM ${listShares} WHERE ${listShares.listId} = ${lists.id} AND ${listShares.userId} = ${userId})`
  );
}

const listPreviewItemSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  content: z.string(),
  addedAt: z.string(),
});

const listResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  createdById: z.string().uuid().nullable(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sharedUserIds: z.array(z.string().uuid()).optional(),
  previewItems: z.array(listPreviewItemSchema).optional(),
});

const listItemResponseSchema = z.object({
  id: z.string().uuid(),
  listId: z.string().uuid(),
  content: z.string(),
  addedAt: z.string(),
  markedOffAt: z.string().nullable(),
});

const listWithItemsSchema = listResponseSchema.extend({
  items: z.array(listItemResponseSchema),
});

const pinnedListSchema = listWithItemsSchema.extend({
  pinId: z.string().uuid(),
  position: z.number(),
});

// List lists
const listListsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: listFilterSchema.merge(paginationSchema),
  },
  responses: {
    200: {
      description: "List of lists",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(listResponseSchema),
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

listsRouter.openapi(listListsRoute, async (c) => {
  const auth = c.get("auth");
  const query = c.req.valid("query");

  const conditions = [
    eq(lists.householdId, auth.householdId),
    listAccessCondition(auth.userId),
  ];
  if (query.search) {
    conditions.push(ilike(lists.name, `%${query.search}%`));
  }

  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const offset = (page - 1) * limit;

  const [listRows, countResult] = await Promise.all([
    db
      .select()
      .from(lists)
      .where(and(...conditions))
      .orderBy(desc(lists.updatedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(lists)
      .where(and(...conditions)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);

  const listIds = listRows.map((r) => r.id);
  const shareRows =
    listIds.length > 0
      ? await db
          .select({ listId: listShares.listId, userId: listShares.userId })
          .from(listShares)
          .where(inArray(listShares.listId, listIds))
      : [];
  const shareMap = new Map<string, string[]>();
  for (const s of shareRows) {
    const arr = shareMap.get(s.listId) ?? [];
    arr.push(s.userId);
    shareMap.set(s.listId, arr);
  }

  // Fetch first 10 active items per list for preview
  const itemRows =
    listIds.length > 0
      ? await db
          .select()
          .from(listItems)
          .where(
            and(
              inArray(listItems.listId, listIds),
              isNull(listItems.markedOffAt)
            )
          )
          .orderBy(asc(listItems.addedAt))
      : [];
  const itemMap = new Map<string, typeof itemRows>();
  for (const item of itemRows) {
    const arr = itemMap.get(item.listId) ?? [];
    if (arr.length < 10) {
      arr.push(item);
    }
    itemMap.set(item.listId, arr);
  }

  const data = listRows.map((row) => ({
    ...row,
    createdById: row.createdById ?? null,
    sharedUserIds: shareMap.get(row.id) ?? [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    previewItems: (itemMap.get(row.id) ?? []).map((item) => ({
      id: item.id,
      listId: item.listId,
      content: item.content,
      addedAt: item.addedAt.toISOString(),
    })),
  }));

  return c.json({
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

// Create list
const createListRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createListSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "List created",
      content: {
        "application/json": {
          schema: z.object({ data: listResponseSchema }),
        },
      },
    },
  },
});

listsRouter.openapi(createListRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [list] = await db
    .insert(lists)
    .values({
      householdId: auth.householdId,
      createdById: auth.userId,
      name: body.name,
    })
    .returning();

  if (!list) throw new Error("Failed to create list");

  const sharedRows = await db
    .select({ userId: listShares.userId })
    .from(listShares)
    .where(eq(listShares.listId, list.id));

  return c.json(
    {
      data: {
        ...list,
        createdById: list.createdById ?? null,
        sharedUserIds: sharedRows.map((s) => s.userId),
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      },
    },
    201,
  );
});

// Get pinned lists (must be before /:id)
const getPinnedRoute = createRoute({
  method: "get",
  path: "/pinned",
  responses: {
    200: {
      description: "Pinned lists with items",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(pinnedListSchema),
          }),
        },
      },
    },
  },
});

listsRouter.openapi(getPinnedRoute, async (c) => {
  const auth = c.get("auth");

  const pins = await db
    .select({
      pinId: listPins.id,
      position: listPins.position,
      listId: listPins.listId,
    })
    .from(listPins)
    .innerJoin(lists, eq(listPins.listId, lists.id))
    .where(
      and(
        eq(listPins.userId, auth.userId),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .orderBy(asc(listPins.position));

  const data = await Promise.all(
    pins.map(async ({ pinId, position, listId }) => {
      const [list] = await db
        .select()
        .from(lists)
        .where(
          and(
            eq(lists.id, listId),
            eq(lists.householdId, auth.householdId),
            listAccessCondition(auth.userId),
          ),
        )
        .limit(1);

      if (!list) return null;

      const items = await db
        .select()
        .from(listItems)
        .where(eq(listItems.listId, listId))
        .orderBy(asc(listItems.addedAt));

      const sharedRows = await db
        .select({ userId: listShares.userId })
        .from(listShares)
        .where(eq(listShares.listId, listId));

      return {
        ...list,
        createdById: list.createdById ?? null,
        sharedUserIds: sharedRows.map((s) => s.userId),
        pinId,
        position,
        items: items.map((item) => ({
          ...item,
          addedAt: item.addedAt.toISOString(),
          markedOffAt: item.markedOffAt?.toISOString() ?? null,
        })),
        createdAt: list.createdAt.toISOString(),
        updatedAt: list.updatedAt.toISOString(),
      };
    }),
  );

  return c.json({ data: data.filter((d): d is NonNullable<typeof d> => d !== null) });
});

// Reorder pins
const reorderPinsRoute = createRoute({
  method: "patch",
  path: "/pins/reorder",
  request: {
    body: {
      content: {
        "application/json": {
          schema: reorderPinsSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Pins reordered",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

listsRouter.openapi(reorderPinsRoute, async (c) => {
  const auth = c.get("auth");
  const { pinIds } = c.req.valid("json");

  for (let i = 0; i < pinIds.length; i++) {
    const pinId = pinIds[i];
    if (!pinId) continue;
    await db
      .update(listPins)
      .set({ position: i })
      .where(
        and(
          eq(listPins.id, pinId),
          eq(listPins.userId, auth.userId),
        ),
      );
  }

  return c.json({ success: true });
});

// Get single list with items
const getListRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
    query: z.object({
      includeMarkedOff: z
        .union([z.literal("true"), z.literal("false")])
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "List with items",
      content: {
        "application/json": {
          schema: z.object({ data: listWithItemsSchema }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(getListRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const itemConditions = [eq(listItems.listId, id)];
  if (query.includeMarkedOff !== "true") {
    itemConditions.push(isNull(listItems.markedOffAt));
  }

  const items = await db
    .select()
    .from(listItems)
    .where(and(...itemConditions))
    .orderBy(asc(listItems.addedAt));

  const sharedRows = await db
    .select({ userId: listShares.userId })
    .from(listShares)
    .where(eq(listShares.listId, list.id));

  return c.json({
    data: {
      ...list,
      createdById: list.createdById ?? null,
      sharedUserIds: sharedRows.map((s) => s.userId),
      items: items.map((item) => ({
        ...item,
        addedAt: item.addedAt.toISOString(),
        markedOffAt: item.markedOffAt?.toISOString() ?? null,
      })),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    },
  });
});

// Update list
const updateListRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateListSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "List updated",
      content: {
        "application/json": {
          schema: z.object({ data: listResponseSchema }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(updateListRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updateData.name = body.name;

  const [list] = await db
    .update(lists)
    .set(updateData)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .returning();

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const sharedRows = await db
    .select({ userId: listShares.userId })
    .from(listShares)
    .where(eq(listShares.listId, list.id));

  return c.json({
    data: {
      ...list,
      createdById: list.createdById ?? null,
      sharedUserIds: sharedRows.map((s) => s.userId),
      createdAt: list.createdAt.toISOString(),
      updatedAt: list.updatedAt.toISOString(),
    },
  });
});

// Update list shares (owner only)
const updateListSharesRoute = createRoute({
  method: "patch",
  path: "/:id/shares",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateListSharesSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Shares updated",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              sharedUserIds: z.array(z.string().uuid()),
            }),
          }),
        },
      },
    },
    403: { description: "Only list owner can update shares" },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(updateListSharesRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const { userIds } = c.req.valid("json");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  // Owner only, or legacy list (createdById null) - anyone with access can claim
  const isOwner = list.createdById === auth.userId;
  const isLegacyClaimable = list.createdById === null;
  if (!isOwner && !isLegacyClaimable) {
    return c.json({ error: "Only list owner can update shares" }, 403);
  }

  if (isLegacyClaimable) {
    await db
      .update(lists)
      .set({ createdById: auth.userId, updatedAt: new Date() })
      .where(eq(lists.id, id));
  }

  await db.delete(listShares).where(eq(listShares.listId, id));

  const inserted =
    userIds.length > 0
      ? await db
          .insert(listShares)
          .values(
            userIds.map((uid: string) => ({
              listId: id,
              userId: uid,
            }))
          )
          .returning({ userId: listShares.userId })
      : [];

  return c.json({
    data: { sharedUserIds: inserted.map((r) => r.userId) },
  });
});

// Delete list
const deleteListRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "List deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(deleteListRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: "List not found" }, 404);
  }

  return c.json({ success: true });
});

// Pin list
const pinListRoute = createRoute({
  method: "post",
  path: "/:id/pin",
  request: {
    params: idParamSchema,
  },
  responses: {
    201: {
      description: "List pinned",
      content: {
        "application/json": {
          schema: z.object({
            data: z.object({
              pinId: z.string().uuid(),
              listId: z.string().uuid(),
              position: z.number(),
            }),
          }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(pinListRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const maxPos = await db
    .select({
      max: sql<number>`coalesce(max(${listPins.position}), -1)`,
    })
    .from(listPins)
    .where(eq(listPins.userId, auth.userId));

  const position = Number(maxPos[0]?.max ?? -1) + 1;

  const [pin] = await db
    .insert(listPins)
    .values({
      userId: auth.userId,
      listId: id,
      position,
    })
    .returning();

  if (!pin) throw new Error("Failed to pin list");

  return c.json(
    {
      data: {
        pinId: pin.id,
        listId: pin.listId,
        position: pin.position,
      },
    },
    201,
  );
});

// Unpin list
const unpinListRoute = createRoute({
  method: "delete",
  path: "/:id/pin",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "List unpinned",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: { description: "Pin not found" },
  },
});

listsRouter.openapi(unpinListRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const [deleted] = await db
    .delete(listPins)
    .where(
      and(
        eq(listPins.listId, id),
        eq(listPins.userId, auth.userId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: "Pin not found" }, 404);
  }

  return c.json({ success: true });
});

// Get list items
const getListItemsRoute = createRoute({
  method: "get",
  path: "/:id/items",
  request: {
    params: idParamSchema,
    query: z.object({
      includeMarkedOff: z
        .union([z.literal("true"), z.literal("false")])
        .optional(),
    }),
  },
  responses: {
    200: {
      description: "List items",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(listItemResponseSchema),
          }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(getListItemsRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const conditions = [eq(listItems.listId, id)];
  if (query.includeMarkedOff !== "true") {
    conditions.push(isNull(listItems.markedOffAt));
  }

  const items = await db
    .select()
    .from(listItems)
    .where(and(...conditions))
    .orderBy(asc(listItems.addedAt));

  const data = items.map((item) => ({
    ...item,
    addedAt: item.addedAt.toISOString(),
    markedOffAt: item.markedOffAt?.toISOString() ?? null,
  }));

  return c.json({ data });
});

// Add list item
const addListItemRoute = createRoute({
  method: "post",
  path: "/:id/items",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: createListItemSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Item added",
      content: {
        "application/json": {
          schema: z.object({ data: listItemResponseSchema }),
        },
      },
    },
    404: { description: "List not found" },
  },
});

listsRouter.openapi(addListItemRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const [item] = await db
    .insert(listItems)
    .values({
      listId: id,
      content: body.content,
    })
    .returning();

  if (!item) throw new Error("Failed to add item");

  await db
    .update(lists)
    .set({ updatedAt: new Date() })
    .where(eq(lists.id, id));

  return c.json(
    {
      data: {
        ...item,
        addedAt: item.addedAt.toISOString(),
        markedOffAt: item.markedOffAt?.toISOString() ?? null,
      },
    },
    201,
  );
});

// Update list item (content or mark off)
const updateListItemRoute = createRoute({
  method: "patch",
  path: "/:id/items/:itemId",
  request: {
    params: listIdItemIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateListItemSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Item updated",
      content: {
        "application/json": {
          schema: z.object({ data: listItemResponseSchema }),
        },
      },
    },
    404: { description: "Item not found" },
  },
});

listsRouter.openapi(updateListItemRoute, async (c) => {
  const auth = c.get("auth");
  const { id, itemId } = c.req.valid("param");
  const body = c.req.valid("json");

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  if (!list) {
    return c.json({ error: "List not found" }, 404);
  }

  const updateData: Record<string, unknown> = {};

  if (body.content !== undefined) updateData.content = body.content;
  if (body.markedOff !== undefined) {
    updateData.markedOffAt = body.markedOff ? new Date() : null;
  }

  if (Object.keys(updateData).length === 0) {
    const [existing] = await db
      .select()
      .from(listItems)
      .where(
        and(
          eq(listItems.id, itemId),
          eq(listItems.listId, id),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ error: "Item not found" }, 404);
    }

    return c.json({
      data: {
        ...existing,
        addedAt: existing.addedAt.toISOString(),
        markedOffAt: existing.markedOffAt?.toISOString() ?? null,
      },
    });
  }

  const [item] = await db
    .update(listItems)
    .set(updateData)
    .where(
      and(
        eq(listItems.id, itemId),
        eq(listItems.listId, id),
      ),
    )
    .returning();

  if (!item) {
    return c.json({ error: "Item not found" }, 404);
  }

  await db
    .update(lists)
    .set({ updatedAt: new Date() })
    .where(eq(lists.id, id));

  return c.json({
    data: {
      ...item,
      addedAt: item.addedAt.toISOString(),
      markedOffAt: item.markedOffAt?.toISOString() ?? null,
    },
  });
});

// Delete list item
const deleteListItemRoute = createRoute({
  method: "delete",
  path: "/:id/items/:itemId",
  request: {
    params: listIdItemIdParamSchema,
  },
  responses: {
    200: {
      description: "Item deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: { description: "Item not found" },
  },
});

listsRouter.openapi(deleteListItemRoute, async (c) => {
  const auth = c.get("auth");
  const { id, itemId } = c.req.valid("param");

  // #region agent log
  try {
    require("fs").appendFileSync(
      "/opt/cursor/logs/debug.log",
      JSON.stringify({
        location: "lists.ts:deleteListItem:entry",
        message: "Delete list item request",
        data: { userId: auth.userId, householdId: auth.householdId, listId: id, itemId },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }) + "\n"
    );
  } catch (_) {}
  // #endregion

  const [list] = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.id, id),
        eq(lists.householdId, auth.householdId),
        listAccessCondition(auth.userId),
      ),
    )
    .limit(1);

  // #region agent log
  try {
    require("fs").appendFileSync(
      "/opt/cursor/logs/debug.log",
      JSON.stringify({
        location: "lists.ts:deleteListItem:afterListCheck",
        message: "List access check result",
        data: { listFound: !!list, listCreatedById: list?.createdById ?? null },
        timestamp: Date.now(),
        hypothesisId: "H1",
      }) + "\n"
    );
  } catch (_) {}
  // #endregion

  if (!list) {
    // #region agent log
    try {
      require("fs").appendFileSync(
        "/opt/cursor/logs/debug.log",
        JSON.stringify({
          location: "lists.ts:deleteListItem:404",
          message: "List not found - access denied or missing",
          data: { listId: id, itemId },
          timestamp: Date.now(),
          hypothesisId: "H1",
        }) + "\n"
      );
    } catch (_) {}
    // #endregion
    return c.json({ error: "List not found" }, 404);
  }

  const [deletedItem] = await db
    .delete(listItems)
    .where(
      and(
        eq(listItems.id, itemId),
        eq(listItems.listId, id),
      ),
    )
    .returning({ id: listItems.id });

  // #region agent log
  try {
    require("fs").appendFileSync(
      "/opt/cursor/logs/debug.log",
      JSON.stringify({
        location: "lists.ts:deleteListItem:afterDelete",
        message: "Delete item result",
        data: { itemDeleted: !!deletedItem },
        timestamp: Date.now(),
        hypothesisId: "H2",
      }) + "\n"
    );
  } catch (_) {}
  // #endregion

  if (!deletedItem) {
    // #region agent log
    try {
      require("fs").appendFileSync(
        "/opt/cursor/logs/debug.log",
        JSON.stringify({
          location: "lists.ts:deleteListItem:404",
          message: "Item not found - no row deleted",
          data: { listId: id, itemId },
          timestamp: Date.now(),
          hypothesisId: "H2",
        }) + "\n"
      );
    } catch (_) {}
    // #endregion
    return c.json({ error: "Item not found" }, 404);
  }

  await db
    .update(lists)
    .set({ updatedAt: new Date() })
    .where(eq(lists.id, id));

  return c.json({ success: true });
});
