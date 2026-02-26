import { tool } from "ai";
import { z } from "zod";
import { familyMembers, tasks } from "@home/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import type { ToolContext } from "../types.js";

export const listFamilyMembersTool = (context: ToolContext) =>
  tool({
    description: "List all family members in the household",
    inputSchema: z.object({}),
    execute: async () => {
      const members = await context.db
        .select({
          id: familyMembers.id,
          firstName: familyMembers.firstName,
          lastName: familyMembers.lastName,
          nickname: familyMembers.nickname,
        })
        .from(familyMembers)
        .where(eq(familyMembers.householdId, context.householdId));

      // Get assigned task counts
      const memberIds = members.map((m) => m.id);
      const taskCounts = memberIds.length > 0
        ? await context.db
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

      const countMap = new Map(taskCounts.map((tc) => [tc.assignedToId, Number(tc.count)]));

      return {
        count: members.length,
        members: members.map((m) => ({
          id: m.id,
          name: m.nickname || `${m.firstName}${m.lastName ? ` ${m.lastName}` : ""}`,
          firstName: m.firstName,
          openTasks: countMap.get(m.id) || 0,
        })),
      };
    },
  });

export const getFamilyMemberTool = (context: ToolContext) =>
  tool({
    description: "Get details about a specific family member",
    inputSchema: z.object({
      memberId: z.string().uuid().describe("The family member ID"),
    }),
    execute: async (input) => {
      const [member] = await context.db
        .select()
        .from(familyMembers)
        .where(
          and(
            eq(familyMembers.id, input.memberId),
            eq(familyMembers.householdId, context.householdId)
          )
        )
        .limit(1);

      if (!member) {
        return { success: false, error: "Family member not found" };
      }

      // Get their tasks
      const memberTasks = await context.db
        .select({
          id: tasks.id,
          title: tasks.title,
          status: tasks.status,
          dueDate: tasks.dueDate,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.assignedToId, input.memberId),
            sql`${tasks.status} != 'done' AND ${tasks.status} != 'archived'`
          )
        )
        .limit(10);

      return {
        id: member.id,
        name: member.nickname || `${member.firstName}${member.lastName ? ` ${member.lastName}` : ""}`,
        firstName: member.firstName,
        lastName: member.lastName,
        nickname: member.nickname,
        birthday: member.birthday,
        assignedTasks: memberTasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          dueDate: t.dueDate?.toISOString().split("T")[0] ?? null,
        })),
      };
    },
  });
