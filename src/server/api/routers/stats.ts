import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { computeLocalDate, hourInZone } from "@/domain/date";
import {
  computeLoad,
  EDUCATIONAL_CARDS,
  selectEducationalCard,
} from "@/domain/load";
import {
  averageRepsPerSet,
  biggestDay,
  computeConsistencyRate,
  hourHistogram,
  variationBreakdown,
} from "@/domain/records";
import { computeWeekStreak } from "@/domain/streak";
import { protectedProcedure, router } from "@/server/api/trpc";
import type { db as Database } from "@/server/db/client";
import { dailyStats, pushSets, userSettings, variations } from "@/server/db/schema";

async function localToday(db: typeof Database, userId: string, tz: string) {
  const [settings] = await db
    .select({
      dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes,
      weeklyTargetDays: userSettings.weeklyTargetDays,
    })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  return {
    localDate: computeLocalDate(
      new Date(),
      tz,
      settings?.dayStartOffsetMinutes ?? 0,
    ),
    weeklyTargetDays: Math.min(7, Math.max(1, settings?.weeklyTargetDays ?? 5)),
  };
}

export const statsRouter = router({
  overview: protectedProcedure
    .input(z.object({ tz: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { localDate, weeklyTargetDays } = await localToday(
        ctx.db,
        ctx.userId,
        input.tz,
      );

      const [dayRows, setRows] = await Promise.all([
        ctx.db
          .select({
            localDate: dailyStats.localDate,
            totalReps: dailyStats.totalReps,
            setCount: dailyStats.setCount,
            volumeLoad: dailyStats.volumeLoad,
            isRestDay: dailyStats.isRestDay,
          })
          .from(dailyStats)
          .where(eq(dailyStats.userId, ctx.userId)),
        ctx.db
          .select({
            reps: pushSets.reps,
            occurredAt: pushSets.occurredAt,
            tz: pushSets.tz,
            family: variations.family,
            intensityFactor: variations.intensityFactor,
          })
          .from(pushSets)
          .innerJoin(variations, eq(pushSets.variationId, variations.id))
          .where(
            and(eq(pushSets.userId, ctx.userId), isNull(pushSets.deletedAt)),
          ),
      ]);

      let lifetimeReps = 0;
      let lifetimeSets = 0;
      let lifetimeLoad = 0;
      let biggestSetReps = 0;
      for (const row of dayRows) {
        lifetimeReps += row.totalReps;
        lifetimeSets += row.setCount;
        lifetimeLoad += row.volumeLoad;
      }
      for (const set of setRows) {
        if (set.reps > biggestSetReps) biggestSetReps = set.reps;
      }

      const streak = computeWeekStreak({
        days: dayRows,
        today: localDate,
        weeklyTargetDays,
      });
      const consistency = computeConsistencyRate({
        days: dayRows,
        today: localDate,
        weeklyTargetDays,
      });
      const peak = biggestDay(dayRows);
      const families = variationBreakdown(
        setRows.map((set) => ({
          family: set.family,
          reps: set.reps,
          volumeLoad: set.reps * set.intensityFactor,
        })),
      );
      const hours = hourHistogram(
        setRows.map((set) => hourInZone(set.occurredAt, set.tz || input.tz)),
      );

      return {
        localDate,
        weeklyTargetDays,
        lifetimeReps,
        lifetimeSets,
        lifetimeLoad,
        averageRepsPerSet: averageRepsPerSet(lifetimeReps, lifetimeSets),
        biggestSetReps: biggestSetReps || null,
        biggestDay: peak,
        streak,
        consistency,
        families,
        hours,
      };
    }),

  load: protectedProcedure
    .input(z.object({ tz: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const { localDate } = await localToday(ctx.db, ctx.userId, input.tz);
      const dayRows = await ctx.db
        .select({
          localDate: dailyStats.localDate,
          totalReps: dailyStats.totalReps,
          setCount: dailyStats.setCount,
          volumeLoad: dailyStats.volumeLoad,
          isRestDay: dailyStats.isRestDay,
        })
        .from(dailyStats)
        .where(eq(dailyStats.userId, ctx.userId));

      const snapshot = computeLoad({ days: dayRows, today: localDate });
      const cardId = selectEducationalCard({
        days: dayRows,
        today: localDate,
        ratio: snapshot.ratio,
      });

      return {
        localDate,
        ...snapshot,
        card: cardId
          ? { id: cardId, ...EDUCATIONAL_CARDS[cardId] }
          : null,
      };
    }),
});
