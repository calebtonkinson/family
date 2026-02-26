import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { familyMembers, tasks } from "@home/db/schema";
import {
  createFamilyMemberSchema,
  updateFamilyMemberSchema,
  idParamSchema,
} from "@home/shared";
import { eq, and, sql, inArray } from "drizzle-orm";

export const familyMembersRouter = new OpenAPIHono();

const familyMemberResponseSchema = z.object({
  id: z.string().uuid(),
  householdId: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string().nullable(),
  nickname: z.string().nullable(),
  birthday: z.string().nullable(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).nullable(),
  avatarUrl: z.string().nullable(),
  profileData: z.record(z.unknown()).nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  assignedTaskCount: z.number().optional(),
});

// List family members
const listFamilyMembersRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "List of family members",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(familyMemberResponseSchema),
          }),
        },
      },
    },
  },
});

familyMembersRouter.openapi(listFamilyMembersRoute, async (c) => {
  const auth = c.get("auth");

  const membersList = await db
    .select()
    .from(familyMembers)
    .where(eq(familyMembers.householdId, auth.householdId));

  // Get assigned task counts
  const memberIds = membersList.map((m) => m.id);
  const taskCounts = memberIds.length > 0
    ? await db
        .select({
          assignedToId: tasks.assignedToId,
          count: sql<number>`count(*)`,
        })
        .from(tasks)
        .where(
          and(
            inArray(tasks.assignedToId, memberIds),
            sql`${tasks.status} != 'done' AND ${tasks.status} != 'archived'`
          )
        )
        .groupBy(tasks.assignedToId)
    : [];

  const taskCountMap = new Map(taskCounts.map((tc) => [tc.assignedToId, Number(tc.count)]));

  const data = membersList.map((member) => ({
    ...member,
    birthday: member.birthday ?? null,
    profileData: member.profileData as Record<string, unknown> | null,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    assignedTaskCount: taskCountMap.get(member.id) || 0,
  }));

  return c.json({ data });
});

// Get single family member
const getFamilyMemberRoute = createRoute({
  method: "get",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Family member details",
      content: {
        "application/json": {
          schema: z.object({ data: familyMemberResponseSchema }),
        },
      },
    },
    404: {
      description: "Family member not found",
    },
  },
});

familyMembersRouter.openapi(getFamilyMemberRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [member] = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.id, id), eq(familyMembers.householdId, auth.householdId)))
    .limit(1);

  if (!member) {
    return c.json({ error: "Family member not found" }, 404);
  }

  // Get task count
  const [taskCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tasks)
    .where(
      and(
        eq(tasks.assignedToId, id),
        sql`${tasks.status} != 'done' AND ${tasks.status} != 'archived'`
      )
    );

  return c.json({
    data: {
      ...member,
      birthday: member.birthday ?? null,
      profileData: member.profileData as Record<string, unknown> | null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      assignedTaskCount: Number(taskCount?.count ?? 0),
    },
  });
});

// Create family member
const createFamilyMemberRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: createFamilyMemberSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Family member created",
      content: {
        "application/json": {
          schema: z.object({ data: familyMemberResponseSchema }),
        },
      },
    },
  },
});

familyMembersRouter.openapi(createFamilyMemberRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  const [member] = await db
    .insert(familyMembers)
    .values({
      householdId: auth.householdId,
      firstName: body.firstName,
      lastName: body.lastName,
      nickname: body.nickname,
      birthday: body.birthday,
      gender: body.gender,
      avatarUrl: body.avatarUrl,
      profileData: body.profileData,
    })
    .returning();

  if (!member) {
    throw new Error("Failed to create family member");
  }

  return c.json(
    {
      data: {
        id: member.id,
        householdId: member.householdId,
        firstName: member.firstName,
        lastName: member.lastName ?? null,
        nickname: member.nickname ?? null,
        birthday: member.birthday ?? null,
        gender: member.gender ?? null,
        avatarUrl: member.avatarUrl ?? null,
        profileData: member.profileData as Record<string, unknown> | null,
        createdAt: member.createdAt.toISOString(),
        updatedAt: member.updatedAt.toISOString(),
        assignedTaskCount: 0,
      },
    },
    201
  );
});

// Update family member
const updateFamilyMemberRoute = createRoute({
  method: "patch",
  path: "/:id",
  request: {
    params: idParamSchema,
    body: {
      content: {
        "application/json": {
          schema: updateFamilyMemberSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Family member updated",
      content: {
        "application/json": {
          schema: z.object({ data: familyMemberResponseSchema }),
        },
      },
    },
    404: {
      description: "Family member not found",
    },
  },
});

familyMembersRouter.openapi(updateFamilyMemberRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (body.firstName !== undefined) updateData.firstName = body.firstName;
  if (body.lastName !== undefined) updateData.lastName = body.lastName;
  if (body.nickname !== undefined) updateData.nickname = body.nickname;
  if (body.birthday !== undefined) updateData.birthday = body.birthday;
  if (body.gender !== undefined) updateData.gender = body.gender;
  if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
  if (body.profileData !== undefined) updateData.profileData = body.profileData;

  const [member] = await db
    .update(familyMembers)
    .set(updateData)
    .where(and(eq(familyMembers.id, id), eq(familyMembers.householdId, auth.householdId)))
    .returning();

  if (!member) {
    return c.json({ error: "Family member not found" }, 404);
  }

  return c.json({
    data: {
      ...member,
      birthday: member.birthday ?? null,
      profileData: member.profileData as Record<string, unknown> | null,
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
    },
  });
});

// Delete family member
const deleteFamilyMemberRoute = createRoute({
  method: "delete",
  path: "/:id",
  request: {
    params: idParamSchema,
  },
  responses: {
    200: {
      description: "Family member deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Family member not found",
    },
  },
});

familyMembersRouter.openapi(deleteFamilyMemberRoute, async (c) => {
  const auth = c.get("auth");
  const { id } = c.req.valid("param");

  const [deleted] = await db
    .delete(familyMembers)
    .where(and(eq(familyMembers.id, id), eq(familyMembers.householdId, auth.householdId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Family member not found" }, 404);
  }

  return c.json({ success: true });
});
