import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { db } from "@/server/db/client";
import { accounts, sessions, userSettings, users } from "@/server/db/schema";

/**
 * Google-only, database session strategy (docs/architecture.md §1). No
 * other providers, no magic-link/email verification flow, hence no
 * `verificationTokensTable` passed to the adapter.
 *
 * Requires `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, and `AUTH_SECRET` — see
 * .env.example.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
  }),
  session: { strategy: "database" },
  providers: [Google],
  events: {
    async createUser({ user }) {
      if (!user.id) return;
      // Every user gets a settings row with sensible defaults the moment
      // they're created, so downstream code (e.g. sets.log) never has to
      // branch on "does this user have settings yet".
      await db.insert(userSettings).values({ userId: user.id }).onConflictDoNothing();
    },
  },
});
