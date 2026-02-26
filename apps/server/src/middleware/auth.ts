import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import * as jose from "jose";
import { db } from "@home/db";
import { users } from "@home/db/schema";
import { eq } from "drizzle-orm";

export interface AuthContext {
  userId: string;
  householdId: string;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    throw new HTTPException(401, { message: "Missing or invalid authorization header" });
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

    // Verify the JWT signed by the frontend
    const { payload } = await jose.jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const email = payload.email as string;
    if (!email) {
      throw new HTTPException(401, { message: "Invalid token: missing email" });
    }

    // Look up user in database
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      throw new HTTPException(401, { message: "User not found" });
    }

    if (!user.householdId) {
      throw new HTTPException(403, { message: "User not associated with a household" });
    }

    c.set("auth", {
      userId: user.id,
      householdId: user.householdId,
      email: user.email,
    });

    await next();
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }
    console.error("Auth error:", error);
    throw new HTTPException(401, { message: "Invalid or expired token" });
  }
});
