import { db } from "@home/db";
import { tasks } from "@home/db/schema";
import { eq, and, lte, isNotNull } from "drizzle-orm";
import { calculateNextDueDate } from "../services/task-service.js";

/**
 * Service for handling recurring task operations.
 * Can be integrated with DBOS workflows for durability.
 */
export const RecurringTaskService = {
  /**
   * Get tasks that are due soon and are recurring.
   */
  async getUpcomingRecurringTasks(beforeDate: Date) {
    const result = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        dueDate: tasks.dueDate,
        householdId: tasks.householdId,
        assignedToId: tasks.assignedToId,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.isRecurring, true),
          eq(tasks.status, "todo"),
          isNotNull(tasks.dueDate),
          lte(tasks.dueDate, beforeDate)
        )
      );

    return result;
  },

  /**
   * Get a single task by ID.
   */
  async getTask(taskId: string) {
    const [task] = await db
      .select()
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .limit(1);

    return task;
  },

  /**
   * Mark a task as complete.
   */
  async markTaskComplete(taskId: string, completedAt: Date) {
    await db
      .update(tasks)
      .set({
        status: "done",
        lastCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(eq(tasks.id, taskId));
  },

  /**
   * Reset a recurring task for its next occurrence.
   */
  async resetForNextOccurrence(taskId: string, nextDueDate: Date) {
    await db
      .update(tasks)
      .set({
        status: "todo",
        dueDate: nextDueDate,
        nextDueDate: nextDueDate,
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  },

  /**
   * Complete a recurring task and schedule the next occurrence.
   */
  async completeRecurringTask(taskId: string) {
    const task = await this.getTask(taskId);

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const now = new Date();
    await this.markTaskComplete(taskId, now);

    if (task.isRecurring && task.recurrenceType) {
      const nextDueDate = calculateNextDueDate(
        task.dueDate || now,
        task.recurrenceType,
        task.recurrenceInterval || 1
      );

      await this.resetForNextOccurrence(taskId, nextDueDate);

      return {
        completed: true,
        isRecurring: true,
        nextDueDate: nextDueDate.toISOString(),
      };
    }

    return {
      completed: true,
      isRecurring: false,
    };
  },
};
