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

interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  data?: Record<string, unknown>;
}

/**
 * Service for sending push notifications.
 * Can be integrated with DBOS workflows for durability.
 */
export const NotificationWorkflowService = {
  /**
   * Get all users in a household.
   */
  async getHouseholdUsers(householdId: string) {
    return db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.householdId, householdId));
  },

  /**
   * Get push subscriptions for a user.
   */
  async getUserSubscriptions(userId: string) {
    return db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, userId));
  },

  /**
   * Get user by family member ID.
   */
  async getUserByFamilyMember(familyMemberId: string) {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.familyMemberId, familyMemberId))
      .limit(1);

    return user;
  },

  /**
   * Remove a subscription (e.g., when it expires).
   */
  async removeSubscription(endpoint: string) {
    await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
  },

  /**
   * Send a push notification to a subscription.
   */
  async sendPushNotification(
    subscription: { endpoint: string; p256dh: string; auth: string },
    notification: NotificationPayload
  ): Promise<boolean> {
    if (!vapidPublicKey || !vapidPrivateKey) {
      console.log("[NotificationService] VAPID keys not configured, skipping push notification");
      return false;
    }

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
      console.error("[NotificationService] Failed to send push notification:", error);

      // If subscription is expired or invalid, remove it
      if (err.statusCode === 410 || err.statusCode === 404) {
        await this.removeSubscription(subscription.endpoint);
      }

      return false;
    }
  },

  /**
   * Send a notification to all users in a household.
   */
  async sendHouseholdNotification(
    householdId: string,
    notification: NotificationPayload
  ) {
    const householdUsers = await this.getHouseholdUsers(householdId);

    const results = [];
    for (const user of householdUsers) {
      const subscriptions = await this.getUserSubscriptions(user.id);

      for (const subscription of subscriptions) {
        const success = await this.sendPushNotification(subscription, notification);
        results.push({ userId: user.id, success });
      }
    }

    return { sent: results.filter((r) => r.success).length, total: results.length };
  },

  /**
   * Send a notification to a specific user.
   */
  async sendUserNotification(userId: string, notification: NotificationPayload) {
    const subscriptions = await this.getUserSubscriptions(userId);

    const results = [];
    for (const subscription of subscriptions) {
      const success = await this.sendPushNotification(subscription, notification);
      results.push({ success });
    }

    return { sent: results.filter((r) => r.success).length, total: results.length };
  },

  /**
   * Send notification to assigned family member's user account (if they have one).
   */
  async sendAssigneeNotification(
    familyMemberId: string,
    notification: NotificationPayload
  ) {
    const user = await this.getUserByFamilyMember(familyMemberId);

    if (!user) {
      console.log(`[NotificationService] No user account for family member ${familyMemberId}`);
      return { sent: 0, total: 0, reason: "no_user_account" };
    }

    return this.sendUserNotification(user.id, notification);
  },
};
