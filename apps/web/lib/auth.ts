import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@home/db";
import { users, accounts, sessions, verificationTokens, households, familyMembers } from "@home/db/schema";
import { eq } from "drizzle-orm";
import { ALLOWED_EMAILS } from "@home/shared";
import * as jose from "jose";

const authConfig = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      // Allow linking to existing users created by seed
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async signIn({ user }) {
      // Only allow specific email addresses
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
