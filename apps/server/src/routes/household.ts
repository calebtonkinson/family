import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { db } from "@home/db";
import { users } from "@home/db/schema";
import { eq } from "drizzle-orm";

export const householdRouter = new OpenAPIHono();

const householdUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().nullable(),
  email: z.string(),
});

// GET /api/household/users - Users in the current household (for share picker, etc.)
const listHouseholdUsersRoute = createRoute({
  method: "get",
  path: "/users",
  responses: {
    200: {
      description: "Users in the household",
      content: {
        "application/json": {
          schema: z.object({
            data: z.array(householdUserSchema),
          }),
        },
      },
    },
  },
});

householdRouter.openapi(listHouseholdUsersRoute, async (c) => {
  const auth = c.get("auth");

  const householdUsers = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
    })
    .from(users)
    .where(eq(users.householdId, auth.householdId));

  return c.json({
    data: householdUsers.map((u) => ({
      id: u.id,
      name: u.name ?? null,
      email: u.email,
    })),
  });
});
