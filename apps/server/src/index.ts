import { serve } from "@hono/node-server";
import { DBOS } from "@dbos-inc/dbos-sdk";
import app from "./app.js";

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
