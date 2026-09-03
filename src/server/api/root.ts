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
 * HTTP round trip. Client mutations go through the IndexedDB outbox and
 * `/api/trpc`, not this helper.
 */
export async function createCaller() {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
}
