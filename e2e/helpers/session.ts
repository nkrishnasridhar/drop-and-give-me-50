import { randomUUID } from "node:crypto";
import { config } from "dotenv";
import type { BrowserContext } from "@playwright/test";

config({ path: ".env.local" });
config({ path: ".env" });

export type E2ESession = {
  userId: string;
  sessionToken: string;
};

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "DATABASE_URL is required for e2e tests. Copy .env.example to .env.local.",
    );
  }
  return value;
}

/**
 * Auth.js v5 database sessions look up `session.session_token` from the
 * cookie value (`authjs.session-token` on HTTP). Injecting that cookie
 * avoids a credentials provider or a test-only login route.
 */
export async function createE2ESession(): Promise<E2ESession> {
  requireDatabaseUrl();
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/server/db/client");
  const { sessions, userSettings, users, variations } = await import(
    "@/server/db/schema"
  );

  const [regular] = await db
    .select({ id: variations.id })
    .from(variations)
    .where(eq(variations.id, "regular"))
    .limit(1);
  if (!regular) {
    throw new Error("No `regular` variation. Run `npm run db:seed` first.");
  }

  const userId = randomUUID();
  const sessionToken = randomUUID();
  const email = `e2e-${userId}@playwright.local`;

  await db.insert(users).values({
    id: userId,
    name: "E2E",
    email,
  });
  await db.insert(userSettings).values({
    userId,
    onboardedAt: new Date(),
    disclaimerAcceptedAt: new Date(),
    tz: "UTC",
  });
  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  return { userId, sessionToken };
}

export async function attachSessionCookie(
  context: BrowserContext,
  sessionToken: string,
  origin: string,
): Promise<void> {
  await context.addCookies([
    {
      name: "authjs.session-token",
      value: sessionToken,
      url: origin,
      httpOnly: true,
      sameSite: "Lax",
      secure: false,
    },
  ]);
}

export async function destroyE2ESession(userId: string): Promise<void> {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/server/db/client");
  const { users } = await import("@/server/db/schema");
  await db.delete(users).where(eq(users.id, userId));
}

export async function countUserSets(userId: string): Promise<number> {
  const { and, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/server/db/client");
  const { pushSets } = await import("@/server/db/schema");
  const rows = await db
    .select({ id: pushSets.id })
    .from(pushSets)
    .where(and(eq(pushSets.userId, userId), isNull(pushSets.deletedAt)));
  return rows.length;
}

export async function sumUserReps(userId: string): Promise<number> {
  const { and, eq, isNull } = await import("drizzle-orm");
  const { db } = await import("@/server/db/client");
  const { pushSets } = await import("@/server/db/schema");
  const rows = await db
    .select({ reps: pushSets.reps })
    .from(pushSets)
    .where(and(eq(pushSets.userId, userId), isNull(pushSets.deletedAt)));
  return rows.reduce((total, row) => total + row.reps, 0);
}

export async function countOutbox(page: {
  evaluate: (fn: () => Promise<number>) => Promise<number>;
}): Promise<number> {
  return page.evaluate(async () => {
    return new Promise<number>((resolve, reject) => {
      const request = indexedDB.open("drop-and-give-me-50");
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("outbox")) {
          database.close();
          resolve(0);
          return;
        }
        const tx = database.transaction("outbox", "readonly");
        const count = tx.objectStore("outbox").count();
        count.onsuccess = () => {
          database.close();
          resolve(count.result);
        };
        count.onerror = () => {
          database.close();
          reject(count.error);
        };
      };
    });
  });
}
