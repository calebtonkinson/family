import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { DBOS } from "@dbos-inc/dbos-sdk";

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

const app = new OpenAPIHono();

// CORS configuration
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

// Logging
app.use("*", logger());

// Health check (no auth required)
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// OpenAPI spec (no auth required)
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "Home Management API",
    version: "1.0.0",
    description: "API for household management application",
  },
  servers: [{ url: "http://localhost:3001", description: "Development" }],
});

// Protected API routes
app.use("/api/*", authMiddleware);

// Mount routers
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

const port = parseInt(process.env.PORT || "3001");

async function main() {
  // Configure and initialize DBOS
  DBOS.setConfig({
    name: "home-server",
    databaseUrl: process.env.DBOS_DATABASE_URL || process.env.DATABASE_URL,
    runAdminServer: false, // Disable DBOS admin server - we use Hono for HTTP
  });
  await DBOS.launch();

  serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      console.log(`Server running on http://localhost:${info.port}`);
      console.log(
        `OpenAPI spec available at http://localhost:${info.port}/openapi.json`,
      );
    },
  );
}

main().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});

export default app;
