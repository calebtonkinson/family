import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { NotificationService } from "../services/notification-service.js";

export const pushRouter = new OpenAPIHono();

const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

// Subscribe to push notifications
const subscribeRoute = createRoute({
  method: "post",
  path: "/subscribe",
  request: {
    body: {
      content: {
        "application/json": {
          schema: pushSubscriptionSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Subscription registered",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

pushRouter.openapi(subscribeRoute, async (c) => {
  const auth = c.get("auth");
  const body = c.req.valid("json");

  await NotificationService.registerSubscription(auth.userId, {
    endpoint: body.endpoint,
    keys: body.keys,
  });

  return c.json({ success: true });
});

// Unsubscribe from push notifications
const unsubscribeRoute = createRoute({
  method: "post",
  path: "/unsubscribe",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            endpoint: z.string().url(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Subscription removed",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
    },
  },
});

pushRouter.openapi(unsubscribeRoute, async (c) => {
  const body = c.req.valid("json");

  await NotificationService.unregisterSubscription(body.endpoint);

  return c.json({ success: true });
});

// Test push notification (dev only)
const testPushRoute = createRoute({
  method: "post",
  path: "/test",
  responses: {
    200: {
      description: "Test notification sent",
      content: {
        "application/json": {
          schema: z.object({
            sent: z.number(),
            total: z.number(),
          }),
        },
      },
    },
  },
});

pushRouter.openapi(testPushRoute, async (c) => {
  const auth = c.get("auth");

  const result = await NotificationService.sendUserNotification(auth.userId, {
    title: "Test Notification",
    body: "This is a test notification from Home Management.",
    url: "/dashboard",
  });

  return c.json(result);
});
