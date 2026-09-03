import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { computeLocalDate } from "@/domain/date";
import { protectedProcedure, router } from "@/server/api/trpc";
import { pushSets, userSettings } from "@/server/db/schema";
import { recomputeDailyStats } from "@/server/services/daily-stats";

const logSetInput = z.object({
  // Client-generated UUIDv7 — see src/lib/uuid.ts and docs/decisions.md #2.
  id: z.string().uuid(),
  variationId: z.string().min(1),
  reps: z.number().int().min(1).max(500),
  // Required so an offline set that syncs later keeps the day it was
  // actually performed, not the day the outbox drained.
  occurredAt: z.string().datetime(),
  // IANA zone, captured fresh at write time (docs/architecture.md §3).
  tz: z.string().min(1),
  note: z.string().max(500).optional(),
  source: z.enum(["app", "shortcut"]).default("app"),
});

export const setsRouter = router({
  /**
   * Idempotent upsert on `id`. Safe to retry indefinitely with the same
   * ID (docs/decisions.md #2) — retrying with the same input is a no-op
   * beyond re-affirming the same row; retrying with a *different* user's
   * ID is rejected rather than silently overwriting their set.
   */
  log: protectedProcedure.input(logSetInput).mutation(async ({ ctx, input }) => {
    const occurredAt = new Date(input.occurredAt);

    const [settings] = await ctx.db
      .select({ dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes })
      .from(userSettings)
      .where(eq(userSettings.userId, ctx.userId));

    const localDate = computeLocalDate(
      occurredAt,
      input.tz,
      settings?.dayStartOffsetMinutes ?? 0,
    );

    const values = {
      variationId: input.variationId,
      reps: input.reps,
      occurredAt,
      localDate,
      tz: input.tz,
      note: input.note,
    };

    const [set] = await ctx.db
      .insert(pushSets)
      .values({
        id: input.id,
        userId: ctx.userId,
        source: input.source,
        ...values,
      })
      .onConflictDoUpdate({
        target: pushSets.id,
        set: { ...values, updatedAt: new Date() },
        // Only applies the update if the existing row belongs to this
        // user. If a different user already owns this ID, the update
        // affects zero rows instead of overwriting their data.
        setWhere: eq(pushSets.userId, ctx.userId),
      })
      .returning();

    if (!set) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "This set ID already belongs to a different user.",
      });
    }

    await recomputeDailyStats(ctx.db, ctx.userId, localDate);

    return set;
  }),
});
