import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { comments, familyMembers, tasks, users } from "@home/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { processAiMention } from "../services/task-agent-service.js";
import { NotificationService } from "../services/notification-service.js";

export const commentsRouter = new OpenAPIHono();

// Comment response schema
const commentResponseSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  content: z.string(),
  isAiGenerated: z.boolean(),
  conversationId: z.string().uuid().nullable().optional(),
  createdAt: z.string(),
  user: z
    .object({
      id: z.string().uuid(),
      firstName: z.string(),
      lastName: z.string().nullable(),
    })
    .nullable()
    .optional(),
});

// Create comment schema
const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty"),
  mentionedFamilyMemberIds: z.array(z.string().uuid()).max(20).optional(),
});

// Params schema
const taskIdParamSchema = z.object({
  taskId: z.string().uuid(),
});

const commentIdParamSchema = z.object({
  taskId: z.string().uuid(),
  commentId: z.string().uuid(),
});

// Detect @ai mention in content
function hasAiMention(content: string): boolean {
  // Match @ai at word boundaries (case insensitive)
  return /@ai\b/i.test(content);
}

// Extract the message for the AI (remove the @ai mention)
function extractAiMessage(content: string): string {
  return content.replace(/@ai\b/gi, "").trim();
}

// List comments for a task
const listCommentsRoute = createRoute({
  method: "get",
  path: "/:taskId/comments",
  request: {
    params: taskIdParamSchema,
  },
  responses: {
    200: {
      description: "List of comments for the task",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(commentResponseSchema),
          }),
        },
      },
    },
  },
});

commentsRouter.openapi(listCommentsRoute, async (c) => {
  const { taskId } = c.req.valid("param");

  // Join comments -> users -> familyMembers to get the family member info
  // comments.userId references users.id, and users.familyMemberId references familyMembers.id
  const commentsList = await db
    .select({
      comment: comments,
      user: {
        id: familyMembers.id,
        firstName: familyMembers.firstName,
        lastName: familyMembers.lastName,
      },
    })
    .from(comments)
    .leftJoin(users, eq(comments.userId, users.id))
    .leftJoin(familyMembers, eq(users.familyMemberId, familyMembers.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(desc(comments.createdAt)); // Most recent first

  const data = commentsList.map((row) => ({
    ...row.comment,
    createdAt: row.comment.createdAt.toISOString(),
    user: row.user?.id
      ? {
          id: row.user.id!,
          firstName: row.user.firstName!,
          lastName: row.user.lastName,
        }
      : null,
  }));

  return c.json({ data });
});

// Create comment
const createCommentRoute = createRoute({
  method: "post",
  path: "/:taskId/comments",
  request: {
    params: taskIdParamSchema,
    body: {
      content: {
        "application/json": {
          schema: createCommentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Comment created",
      content: {
        "application/json": {
          schema: z.object({
            data: commentResponseSchema,
            aiTriggered: z.boolean().optional(),
          }),
        },
      },
    },
    404: {
      description: "Task not found",
    },
  },
});

commentsRouter.openapi(createCommentRoute, async (c) => {
  const auth = c.get("auth");
  const { taskId } = c.req.valid("param");
  const body = c.req.valid("json");

  const [task] = await db
    .select({
      id: tasks.id,
      title: tasks.title,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.householdId, auth.householdId)))
    .limit(1);

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  const [comment] = await db
    .insert(comments)
    .values({
      taskId,
      userId: auth.userId,
      content: body.content,
      isAiGenerated: false,
    })
    .returning();

  if (!comment) {
    throw new Error("Failed to create comment");
  }

  // Fetch the user's family member info (users.familyMemberId -> familyMembers.id)
  const [userWithFamilyMember] = await db
    .select({
      id: familyMembers.id,
      firstName: familyMembers.firstName,
      lastName: familyMembers.lastName,
    })
    .from(users)
    .leftJoin(familyMembers, eq(users.familyMemberId, familyMembers.id))
    .where(eq(users.id, auth.userId))
    .limit(1);

  const user = userWithFamilyMember?.id
    ? {
        id: userWithFamilyMember.id!,
        firstName: userWithFamilyMember.firstName!,
        lastName: userWithFamilyMember.lastName,
      }
    : null;

  const mentionedFamilyMemberIds = Array.from(
    new Set(body.mentionedFamilyMemberIds ?? []),
  );
  if (mentionedFamilyMemberIds.length > 0) {
    const validMentionedMembers = await db
      .select({
        id: familyMembers.id,
      })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.householdId, auth.householdId),
          inArray(familyMembers.id, mentionedFamilyMemberIds),
        ),
      );

    const validMentionedMemberIds = validMentionedMembers.map((member) => member.id);
    if (validMentionedMemberIds.length > 0) {
      const mentionedUsers = await db
        .select({
          id: users.id,
        })
        .from(users)
        .where(
          and(
            eq(users.householdId, auth.householdId),
            inArray(users.familyMemberId, validMentionedMemberIds),
          ),
        );

      const commenterName = user
        ? `${user.firstName} ${user.lastName ?? ""}`.trim()
        : "Someone";
      const mentionNotificationTitle = "Task mention";
      const mentionNotificationBody = `${commenterName} mentioned you on "${task.title}"`;

      await Promise.allSettled(
        mentionedUsers
          .filter((mentionedUser) => mentionedUser.id !== auth.userId)
          .map((mentionedUser) =>
            NotificationService.sendUserNotification(mentionedUser.id, {
              title: mentionNotificationTitle,
              body: mentionNotificationBody,
              url: `/tasks/${task.id}`,
              data: {
                type: "task_mention",
                taskId: task.id,
                commentId: comment.id,
              },
            }),
          ),
      );
    }
  }

  // Check for @ai mention and trigger agent asynchronously
  let aiTriggered = false;
  if (hasAiMention(body.content)) {
    aiTriggered = true;
    const aiMessage = extractAiMessage(body.content);

    // Fire and forget - don't await, let it run in background
    processAiMention({
      taskId,
      commentId: comment.id,
      userMessage: aiMessage || body.content, // Fallback to full content if extraction fails
      householdId: auth.householdId,
      userId: auth.userId,
    }).catch((error) => {
      console.error("[Comments] Error triggering AI agent:", error);
    });
  }

  return c.json(
    {
      data: {
        ...comment,
        createdAt: comment.createdAt.toISOString(),
        user: user || null,
      },
      aiTriggered,
    },
    201
  );
});

// Delete comment
const deleteCommentRoute = createRoute({
  method: "delete",
  path: "/:taskId/comments/:commentId",
  request: {
    params: commentIdParamSchema,
  },
  responses: {
    200: {
      description: "Comment deleted",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
    404: {
      description: "Comment not found",
    },
  },
});

commentsRouter.openapi(deleteCommentRoute, async (c) => {
  const auth = c.get("auth");
  const { commentId } = c.req.valid("param");

  // Allow deleting own comments OR AI-generated comments
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment) {
    return c.json({ error: "Comment not found" }, 404);
  }

  // Can only delete own comments or AI comments
  if (comment.userId !== auth.userId && !comment.isAiGenerated) {
    return c.json({ error: "Not authorized to delete this comment" }, 404);
  }

  await db.delete(comments).where(eq(comments.id, commentId));

  return c.json({ success: true });
});
