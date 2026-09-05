import { TRPCError } from "@trpc/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import {
  computeLocalDate,
  enumerateDates,
  MAX_STATS_RANGE_DAYS,
  startOfWeekMonday,
} from "@/domain/date";
import { countCompletedDays, isCompletedDay } from "@/domain/streak";
import { isoDateSchema } from "@/server/api/iso-date";
import { protectedProcedure, router } from "@/server/api/trpc";
import type { db as Database } from "@/server/db/client";
import { dailyStats, userSettings } from "@/server/db/schema";

async function loadDaySettings(db: typeof Database, userId: string) {
  const [settings] = await db
    .select({
      dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes,
      weeklyTargetDays: userSettings.weeklyTargetDays,
      dailyRepGoal: userSettings.dailyRepGoal,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return {
    dayStartOffsetMinutes: settings?.dayStartOffsetMinutes ?? 0,
    weeklyTargetDays: Math.min(7, Math.max(1, settings?.weeklyTargetDays ?? 5)),
    dailyRepGoal: settings?.dailyRepGoal ?? 50,
  };
}

export const daysRouter = router({
  /**
   * "Today" is computed from the timezone the client is physically in
   * right now (not a stored setting), plus the user's day-start offset
   * preference — same rule as sets.log uses to compute local_date.
   */
  today: protectedProcedure
    .input(z.object({ tz: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const settings = await loadDaySettings(ctx.db, ctx.userId);
      const localDate = computeLocalDate(
        new Date(),
        input.tz,
        settings.dayStartOffsetMinutes,
      );
      const weekStart = startOfWeekMonday(localDate);
      const weekDates = enumerateDates(weekStart, localDate);

      const weekRows = await ctx.db
        .select({
          localDate: dailyStats.localDate,
          totalReps: dailyStats.totalReps,
          setCount: dailyStats.setCount,
          volumeLoad: dailyStats.volumeLoad,
          isRestDay: dailyStats.isRestDay,
        })
        .from(dailyStats)
        .where(
          and(
            eq(dailyStats.userId, ctx.userId),
            gte(dailyStats.localDate, weekStart),
            lte(dailyStats.localDate, localDate),
          ),
        );

      const byDate = new Map(weekRows.map((row) => [row.localDate, row]));
      const todayRow = byDate.get(localDate);
      const completedDates = weekDates.filter((date) =>
        isCompletedDay(byDate.get(date)),
      );

      return {
        localDate,
        totalReps: todayRow?.totalReps ?? 0,
        setCount: todayRow?.setCount ?? 0,
        volumeLoad: todayRow?.volumeLoad ?? 0,
        isRestDay: todayRow?.isRestDay ?? false,
        dailyRepGoal: settings.dailyRepGoal,
        ring: {
          weekStart,
          activeDays: countCompletedDays(byDate, weekDates),
          targetDays: settings.weeklyTargetDays,
          completedDates,
        },
      };
    }),

  range: protectedProcedure
    .input(
      z.object({
        from: isoDateSchema,
        to: isoDateSchema,
      }),
    )
    .query(async ({ ctx, input }) => {
      const dates = enumerateDates(input.from, input.to);
      if (dates.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "`from` must be on or before `to`.",
        });
      }
      if (dates.length > MAX_STATS_RANGE_DAYS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Range cannot exceed ${MAX_STATS_RANGE_DAYS} days.`,
        });
      }

      return ctx.db
        .select({
          localDate: dailyStats.localDate,
          totalReps: dailyStats.totalReps,
          setCount: dailyStats.setCount,
          volumeLoad: dailyStats.volumeLoad,
          isRestDay: dailyStats.isRestDay,
        })
        .from(dailyStats)
        .where(
          and(
            eq(dailyStats.userId, ctx.userId),
            gte(dailyStats.localDate, input.from),
            lte(dailyStats.localDate, input.to),
          ),
        )
        .orderBy(dailyStats.localDate);
    }),
});
