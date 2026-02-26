import { db } from "@home/db";
import { tasks, households, familyMembers } from "@home/db/schema";
import { eq, and, lte, gte, isNotNull, sql } from "drizzle-orm";
import { NotificationService } from "../services/notification-service.js";
import { startOfDay, endOfDay, format } from "date-fns";

/**
 * Service for daily digest operations.
 * Can be invoked from a cron job or DBOS scheduled workflow.
 */
export const DailyDigestService = {
  async getAllHouseholds() {
    return db.select({ id: households.id }).from(households);
  },

  async getTasksForDate(householdId: string, startDate: Date, endDate: Date) {
    return db
      .select({
        id: tasks.id,
        title: tasks.title,
        priority: tasks.priority,
        assignedToName: familyMembers.firstName,
      })
      .from(tasks)
      .leftJoin(familyMembers, eq(tasks.assignedToId, familyMembers.id))
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo"),
          gte(tasks.dueDate, startDate),
          lte(tasks.dueDate, endDate)
        )
      )
      .orderBy(tasks.priority, tasks.dueDate);
  },

  async getOverdueTasks(householdId: string, beforeDate: Date) {
    return db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, beforeDate)
        )
      );
  },

  async getCompletedTasks(householdId: string, startDate: Date, endDate: Date) {
    return db
      .select({ id: tasks.id, title: tasks.title })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "done"),
          gte(tasks.lastCompletedAt, startDate),
          lte(tasks.lastCompletedAt, endDate)
        )
      );
  },

  async getWeeklyStats(householdId: string, startDate: Date, endDate: Date) {
    const [completed] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          gte(tasks.lastCompletedAt, startDate),
          lte(tasks.lastCompletedAt, endDate)
        )
      );

    const [created] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          gte(tasks.createdAt, startDate),
          lte(tasks.createdAt, endDate)
        )
      );

    const [pending] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo")
        )
      );

    const [overdue] = await db
      .select({ count: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, startDate)
        )
      );

    return {
      completed: Number(completed?.count ?? 0),
      created: Number(created?.count ?? 0),
      pending: Number(pending?.count ?? 0),
      overdue: Number(overdue?.count ?? 0),
    };
  },

  /**
   * Send daily digest to all households.
   * Intended to run at 7am.
   */
  async sendDailyDigest() {
    console.log("[DailyDigest] Sending daily digests...");

    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    const allHouseholds = await this.getAllHouseholds();

    for (const household of allHouseholds) {
      const todayTasks = await this.getTasksForDate(
        household.id,
        startOfToday,
        endOfToday
      );

      const overdueTasks = await this.getOverdueTasks(household.id, startOfToday);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const completedYesterday = await this.getCompletedTasks(
        household.id,
        startOfDay(yesterday),
        endOfDay(yesterday)
      );

      const lines: string[] = [];

      if (overdueTasks.length > 0) {
        lines.push(`⚠️ ${overdueTasks.length} overdue task(s)`);
      }

      if (todayTasks.length > 0) {
        lines.push(`📋 ${todayTasks.length} task(s) due today`);
        todayTasks.slice(0, 3).forEach((task) => {
          const assignee = task.assignedToName ? ` (${task.assignedToName})` : "";
          lines.push(`  • ${task.title}${assignee}`);
        });
        if (todayTasks.length > 3) {
          lines.push(`  ...and ${todayTasks.length - 3} more`);
        }
      } else {
        lines.push("✨ No tasks due today!");
      }

      if (completedYesterday.length > 0) {
        lines.push(`\n✅ ${completedYesterday.length} task(s) completed yesterday`);
      }

      const body = lines.join("\n");

      await NotificationService.sendHouseholdNotification(household.id, {
        title: `Daily Summary - ${format(today, "MMM d")}`,
        body,
        url: "/dashboard",
      });
    }

    return { processed: allHouseholds.length };
  },

  /**
   * Send weekly summary to all households.
   * Intended to run Sunday at 6pm.
   */
  async sendWeeklySummary() {
    console.log("[DailyDigest] Sending weekly summaries...");

    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const allHouseholds = await this.getAllHouseholds();

    for (const household of allHouseholds) {
      const stats = await this.getWeeklyStats(
        household.id,
        startOfDay(weekAgo),
        endOfDay(today)
      );

      const lines: string[] = [
        `📊 Week in Review`,
        ``,
        `✅ Completed: ${stats.completed}`,
        `📋 Created: ${stats.created}`,
        `⏳ Still pending: ${stats.pending}`,
      ];

      if (stats.overdue > 0) {
        lines.push(`⚠️ Overdue: ${stats.overdue}`);
      }

      await NotificationService.sendHouseholdNotification(household.id, {
        title: "Weekly Summary",
        body: lines.join("\n"),
        url: "/dashboard",
      });
    }

    return { processed: allHouseholds.length };
  },
};
