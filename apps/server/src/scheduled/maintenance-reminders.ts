import { db } from "@home/db";
import { tasks, households } from "@home/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { NotificationService } from "../services/notification-service.js";
import { addDays, startOfDay, endOfDay } from "date-fns";

/**
 * Service for maintenance reminder operations.
 * Can be invoked from a cron job or DBOS scheduled workflow.
 */
export const MaintenanceRemindersService = {
  async getAllHouseholds() {
    return db.select({ id: households.id }).from(households);
  },

  async getUpcomingMaintenanceTasks(householdId: string, beforeDate: Date) {
    return db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, beforeDate)
        )
      )
      .orderBy(tasks.dueDate);
  },

  async getOverdueTasks(householdId: string, beforeDate: Date) {
    return db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        priority: tasks.priority,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.householdId, householdId),
          eq(tasks.status, "todo"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, beforeDate)
        )
      )
      .orderBy(tasks.priority, tasks.dueDate);
  },

  /**
   * Send maintenance reminders to all households.
   * Intended to run daily at 8am.
   */
  async sendMaintenanceReminders() {
    console.log("[MaintenanceReminders] Running daily maintenance check...");

    const today = startOfDay(new Date());
    const nextWeek = endOfDay(addDays(today, 7));

    const allHouseholds = await this.getAllHouseholds();

    for (const household of allHouseholds) {
      const upcomingTasks = await this.getUpcomingMaintenanceTasks(
        household.id,
        nextWeek
      );

      if (upcomingTasks.length > 0) {
        const todayTasks = upcomingTasks.filter(
          (t) => t.dueDate && startOfDay(t.dueDate) <= today
        );
        const thisWeekTasks = upcomingTasks.filter(
          (t) => t.dueDate && startOfDay(t.dueDate) > today
        );

        let body = "";
        if (todayTasks.length > 0) {
          body += `${todayTasks.length} task(s) due today or overdue. `;
        }
        if (thisWeekTasks.length > 0) {
          body += `${thisWeekTasks.length} task(s) coming up this week.`;
        }

        await NotificationService.sendHouseholdNotification(household.id, {
          title: "Maintenance Reminders",
          body: body.trim(),
          url: "/tasks?status=todo",
        });
      }
    }

    return { processed: allHouseholds.length };
  },

  /**
   * Check for overdue tasks and send urgent reminders.
   * Intended to run at noon.
   */
  async checkOverdueTasks() {
    console.log("[MaintenanceReminders] Checking for overdue tasks...");

    const allHouseholds = await this.getAllHouseholds();
    const yesterday = addDays(new Date(), -1);

    for (const household of allHouseholds) {
      const overdueTasks = await this.getOverdueTasks(household.id, yesterday);

      if (overdueTasks.length > 0) {
        const taskList = overdueTasks
          .slice(0, 3)
          .map((t) => `• ${t.title}`)
          .join("\n");

        const moreText =
          overdueTasks.length > 3 ? `\n...and ${overdueTasks.length - 3} more` : "";

        await NotificationService.sendHouseholdNotification(household.id, {
          title: `${overdueTasks.length} Overdue Task(s)`,
          body: taskList + moreText,
          url: "/tasks?status=todo",
        });
      }
    }

    return { processed: allHouseholds.length };
  },
};
