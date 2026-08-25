import { asc, eq } from "drizzle-orm";
import { protectedProcedure, router } from "@/server/api/trpc";
import { variations } from "@/server/db/schema";

export const variationsRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select()
      .from(variations)
      .where(eq(variations.isActive, true))
      .orderBy(asc(variations.sortOrder));
  }),
});
