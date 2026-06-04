import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import {
  users,
  accounts,
  sessions,
  verificationTokens,
} from "@/lib/db/schema";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  // Credentials provider requires jwt strategy — DB sessions are incompatible.
  session: { strategy: "jwt" },
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      authorize: async (c) => {
        const email = c?.email as string;
        const password = c?.password as string;
        if (!email || !password) return null;

        const [u] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!u?.hashedPassword) return null;
        if (!(await bcrypt.compare(password, u.hashedPassword))) return null;

        return { id: u.id, email: u.email, name: u.name ?? null };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // On sign-in, user object is present — persist id + email into the token.
      if (user) {
        token.id = user.id;
        token.email = user.email;
      }
      return token;
    },
    async session({ session, token }) {
      // Surface id from the JWT token onto session.user so every page can use it.
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
});
