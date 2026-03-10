import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { tasksRouter } from "./routes/tasks.js";
import { projectsRouter } from "./routes/projects.js";
import { themesRouter } from "./routes/themes.js";
import { familyMembersRouter } from "./routes/family-members.js";
import { conversationsRouter } from "./routes/conversations.js";
import { aiRouter } from "./routes/ai.js";
import { pushRouter } from "./routes/push.js";
import { commentsRouter } from "./routes/comments.js";
import { recipesRouter } from "./routes/recipes.js";
import { listsRouter } from "./routes/lists.js";
import { householdRouter } from "./routes/household.js";
import { mealPlansRouter } from "./routes/meal-plans.js";
import { mealPlanningPreferencesRouter } from "./routes/meal-planning-preferences.js";
import { researchRouter } from "./routes/research.js";
import { authMiddleware } from "./middleware/auth.js";

export function createApp() {
  const app = new OpenAPIHono();

  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
  ];

  app.use(
    "*",
    cors({
      origin: allowedOrigins,
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  app.use("*", logger());

  app.get("/health", (c) =>
    c.json({ status: "ok", timestamp: new Date().toISOString() }),
  );

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: {
      title: "Home Management API",
      version: "1.0.0",
      description: "API for household management application",
    },
    servers: [{ url: "http://localhost:3001", description: "Development" }],
  });

  app.use("/api/*", authMiddleware);

  app.route("/api/tasks", tasksRouter);
  app.route("/api/projects", projectsRouter);
  app.route("/api/themes", themesRouter);
  app.route("/api/family-members", familyMembersRouter);
  app.route("/api/conversations", conversationsRouter);
  app.route("/api/conversations", researchRouter);
  app.route("/api/ai", aiRouter);
  app.route("/api/push", pushRouter);
  app.route("/api/tasks", commentsRouter);
  app.route("/api/recipes", recipesRouter);
  app.route("/api/lists", listsRouter);
  app.route("/api/household", householdRouter);
  app.route("/api/meal-plans", mealPlansRouter);
  app.route("/api/meal-planning-preferences", mealPlanningPreferencesRouter);

  return app;
}

const app = createApp();

export default app;
