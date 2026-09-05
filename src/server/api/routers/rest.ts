import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { computeLocalDate } from "@/domain/date";
import { isoDateSchema } from "@/server/api/iso-date";
import { protectedProcedure, router } from "@/server/api/trpc";
import type { db as Database } from "@/server/db/client";
import { restDays, userSettings } from "@/server/db/schema";
import { recomputeDailyStats } from "@/server/services/daily-stats";

async function resolveRestDate(
  db: typeof Database,
  userId: string,
  tz: string,
  requested: string | undefined,
): Promise<string> {
  const [settings] = await db
    .select({ dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));

  const today = computeLocalDate(
    new Date(),
    tz,
    settings?.dayStartOffsetMinutes ?? 0,
  );
  const localDate = requested ?? today;
  if (localDate > today) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Cannot mark a rest day in the future.",
    });
  }
  return localDate;
}

export const restRouter = router({
  mark: protectedProcedure
    .input(
      z.object({
        tz: z.string().min(1),
        localDate: isoDateSchema.optional(),
        note: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const localDate = await resolveRestDate(
        ctx.db,
        ctx.userId,
        input.tz,
        input.localDate,
      );

      await ctx.db
        .insert(restDays)
        .values({
          userId: ctx.userId,
          localDate,
          note: input.note,
        })
        .onConflictDoNothing();

      await recomputeDailyStats(ctx.db, ctx.userId, localDate);
      return { localDate, isRestDay: true };
    }),

  unmark: protectedProcedure
    .input(
      z.object({
        tz: z.string().min(1),
        localDate: isoDateSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const localDate = await resolveRestDate(
        ctx.db,
        ctx.userId,
        input.tz,
        input.localDate,
      );

      await ctx.db
        .delete(restDays)
        .where(
          and(eq(restDays.userId, ctx.userId), eq(restDays.localDate, localDate)),
        );

      await recomputeDailyStats(ctx.db, ctx.userId, localDate);
      return { localDate, isRestDay: false };
    }),
});
