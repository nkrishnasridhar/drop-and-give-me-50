import { daysRouter } from "@/server/api/routers/days";
import { setsRouter } from "@/server/api/routers/sets";
import { variationsRouter } from "@/server/api/routers/variations";
import { createTRPCContext, router } from "@/server/api/trpc";

export const appRouter = router({
  days: daysRouter,
  sets: setsRouter,
  variations: variationsRouter,
});

export type AppRouter = typeof appRouter;

/**
 * Server-side caller for use directly from React Server Components — no
 * HTTP round trip. The client component data flow (mutations from the
 * Log form) goes through the HTTP handler instead; see
 * src/lib/trpc-client.ts.
 */
export async function createCaller() {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
}
