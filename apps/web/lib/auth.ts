import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@home/db";
import { users, accounts, sessions, verificationTokens, households, familyMembers } from "@home/db/schema";
import { eq } from "drizzle-orm";
import { ALLOWED_EMAILS } from "@home/shared";
import * as jose from "jose";

const providers = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    allowDangerousEmailAccountLinking: true,
  }),
];

if (process.env.DEV_LOGIN_ENABLED === "true") {
  providers.push(
    Credentials({
      id: "dev-credentials",
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || password !== process.env.DEV_LOGIN_PASSWORD) return null;

        const [existing] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (existing) {
          return { id: existing.id, email: existing.email, name: existing.name };
        }

        const [household] = await db.select().from(households).limit(1);
        let householdId: string;
        if (household) {
          householdId = household.id;
        } else {
          const [h] = await db.insert(households).values({ name: "My Household" }).returning();
          if (!h) return null;
          householdId = h.id;
        }

        const nameParts = email.split("@")[0]!.split(".");
        const [fm] = await db.insert(familyMembers).values({
          householdId,
          firstName: nameParts[0] || "Dev",
          lastName: nameParts.slice(1).join(" ") || "User",
        }).returning();
        if (!fm) return null;

        const [newUser] = await db.insert(users).values({
          householdId,
          familyMemberId: fm.id,
          email,
          name: nameParts.join(" "),
        }).returning();
        if (!newUser) return null;

        return { id: newUser.id, email: newUser.email, name: newUser.name };
      },
    })
  );
}

const authConfig = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "dev-credentials") return true;
      if (!user.email || !ALLOWED_EMAILS.includes(user.email as typeof ALLOWED_EMAILS[number])) {
        return false;
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // Check if user exists in our database
        const [existingUser] = await db
          .select()
          .from(users)
          .where(eq(users.email, user.email!))
          .limit(1);

        if (existingUser) {
          token.householdId = existingUser.householdId ?? undefined;
          token.userId = existingUser.id;
        } else {
          // Create new user on first login
          // First, check if there's an existing household
          const [existingHousehold] = await db
            .select()
            .from(households)
            .limit(1);

          let householdId: string;

          if (existingHousehold) {
            householdId = existingHousehold.id;
          } else {
            // Create new household
            const [newHousehold] = await db
              .insert(households)
              .values({ name: "My Household" })
              .returning();
            if (!newHousehold) throw new Error("Failed to create household");
            householdId = newHousehold.id;
          }

          // Create family member
          const nameParts = (user.name || "User").split(" ");
          const [familyMember] = await db
            .insert(familyMembers)
            .values({
              householdId,
              firstName: nameParts[0] || "User",
              lastName: nameParts.slice(1).join(" ") || null,
            })
            .returning();
          if (!familyMember) throw new Error("Failed to create family member");

          // Create user
          const [newUser] = await db
            .insert(users)
            .values({
              householdId,
              familyMemberId: familyMember.id,
              email: user.email!,
              name: user.name,
              image: user.image,
            })
            .returning();
          if (!newUser) throw new Error("Failed to create user");

          token.householdId = householdId;
          token.userId = newUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.userId as string;
        session.user.householdId = token.householdId as string;

        // Generate a signed JWT for API requests
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
        const accessToken = await new jose.SignJWT({
          email: token.email as string,
          userId: token.userId as string,
          householdId: token.householdId as string,
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setExpirationTime("1h")
          .sign(secret);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session as any).accessToken = accessToken;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const handlers = authConfig.handlers as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth = authConfig.auth as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signIn = authConfig.signIn as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const signOut = authConfig.signOut as any;

// Extend the session and JWT types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      householdId: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    accessToken: string;
  }

  interface JWT {
    userId?: string;
    householdId?: string;
  }
}
