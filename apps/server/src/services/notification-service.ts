import { db } from "@home/db";
import { pushSubscriptions, users } from "@home/db/schema";
import { eq } from "drizzle-orm";
import webpush from "web-push";

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    "mailto:contact@homemanagement.app",
    vapidPublicKey,
    vapidPrivateKey
  );
}

interface TaskReminderInput {
  taskId: string;
  title: string;
  dueDate: Date | null;
  householdId: string;
}

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

export const NotificationService = {
  /**
   * Send a task reminder notification to all users in the household.
   */
  async sendTaskReminder(input: TaskReminderInput) {
    const dueDateStr = input.dueDate
      ? input.dueDate.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        })
      : "No due date";

    return this.sendHouseholdNotification(input.householdId, {
      title: "Task Reminder",
      body: `${input.title} - Due: ${dueDateStr}`,
      url: `/tasks/${input.taskId}`,
      data: { taskId: input.taskId },
    });
  },

  /**
   * Send a notification to all users in a household.
   */
  async sendHouseholdNotification(
    householdId: string,
    notification: NotificationPayload
  ) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[NotificationService] VAPID keys not configured");
      return { sent: 0, total: 0 };
    }

    // Get all users in the household
    const householdUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.householdId, householdId));

    let sent = 0;
    let total = 0;

    for (const user of householdUsers) {
      // Get push subscriptions for each user
      const subscriptions = await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.userId, user.id));

      for (const subscription of subscriptions) {
        total++;
        const success = await this.sendPushNotification(subscription, notification);
        if (success) sent++;
      }
    }

    console.log(`[NotificationService] Sent ${sent}/${total} notifications to household ${householdId}`);
    return { sent, total };
  },

  /**
   * Send a notification to a specific user.
   */
  async sendUserNotification(userId: string, notification: NotificationPayload) {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[NotificationService] VAPID keys not configured");
      return { sent: 0, total: 0 };
    }

    const subscriptions = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));

    let sent = 0;

    for (const subscription of subscriptions) {
      const success = await this.sendPushNotification(subscription, notification);
      if (success) sent++;
    }

    return { sent, total: subscriptions.length };
  },

  /**
   * Send a push notification to a specific subscription.
   */
  async sendPushNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    notification: NotificationPayload
  ): Promise<boolean> {
    try {
      const pushSubscription = {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      };

      await webpush.sendNotification(
        pushSubscription,
        JSON.stringify({
          title: notification.title,
          body: notification.body,
          url: notification.url,
          data: notification.data,
        })
      );

      return true;
    } catch (error: unknown) {
      const err = error as { statusCode?: number };
      console.error("[NotificationService] Failed to send push:", error);

      // If subscription is expired or invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.endpoint, subscription.endpoint));
        console.log("[NotificationService] Removed invalid subscription");
      }

      return false;
    }
  },

  /**
   * Register a new push subscription for a user.
   */
  async registerSubscription(
    userId: string,
    subscriptionData: { endpoint: string; keys: { p256dh: string; auth: string } }
  ) {
    // Check if subscription already exists
    const [existing] = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, subscriptionData.endpoint))
      .limit(1);

    if (existing) {
      // Update existing subscription
      await db
        .update(pushSubscriptions)
        .set({
          userId,
          p256dh: subscriptionData.keys.p256dh,
          auth: subscriptionData.keys.auth,
        })
        .where(eq(pushSubscriptions.endpoint, subscriptionData.endpoint));
    } else {
      // Create new subscription
      await db.insert(pushSubscriptions).values({
        userId,
        endpoint: subscriptionData.endpoint,
        p256dh: subscriptionData.keys.p256dh,
        auth: subscriptionData.keys.auth,
      });
    }

    return { success: true };
  },

  /**
   * Remove a push subscription.
   */
  async unregisterSubscription(endpoint: string) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
    return { success: true };
  },
};
