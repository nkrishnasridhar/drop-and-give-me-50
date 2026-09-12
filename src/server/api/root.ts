import { daysRouter } from "@/server/api/routers/days";
import { pushRouter } from "@/server/api/routers/push";
import { restRouter } from "@/server/api/routers/rest";
import { setsRouter } from "@/server/api/routers/sets";
import { settingsRouter } from "@/server/api/routers/settings";
import { statsRouter } from "@/server/api/routers/stats";
import { variationsRouter } from "@/server/api/routers/variations";
import { createTRPCContext, router } from "@/server/api/trpc";

export const appRouter = router({
  days: daysRouter,
  push: pushRouter,
  rest: restRouter,
  sets: setsRouter,
  settings: settingsRouter,
  stats: statsRouter,
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
