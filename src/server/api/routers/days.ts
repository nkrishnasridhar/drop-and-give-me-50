import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { computeLocalDate } from "@/domain/date";
import { protectedProcedure, router } from "@/server/api/trpc";
import { dailyStats, userSettings } from "@/server/db/schema";

export const daysRouter = router({
  /**
   * "Today" is computed from the timezone the client is physically in
   * right now (not a stored setting), plus the user's day-start offset
   * preference — same rule as sets.log uses to compute local_date.
   */
  today: protectedProcedure
    .input(z.object({ tz: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [settings] = await ctx.db
        .select({ dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes })
        .from(userSettings)
        .where(eq(userSettings.userId, ctx.userId));

      const localDate = computeLocalDate(
        new Date(),
        input.tz,
        settings?.dayStartOffsetMinutes ?? 0,
      );

      const [stats] = await ctx.db
        .select({
          totalReps: dailyStats.totalReps,
          setCount: dailyStats.setCount,
          volumeLoad: dailyStats.volumeLoad,
        })
        .from(dailyStats)
        .where(
          and(eq(dailyStats.userId, ctx.userId), eq(dailyStats.localDate, localDate)),
        );

      return {
        localDate,
        totalReps: stats?.totalReps ?? 0,
        setCount: stats?.setCount ?? 0,
        volumeLoad: stats?.volumeLoad ?? 0,
      };
    }),
});
