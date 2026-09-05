import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { z } from "zod";
import { computeLocalDate } from "@/domain/date";
import { isoDateSchema } from "@/server/api/iso-date";
import { protectedProcedure, router } from "@/server/api/trpc";
import { pushSets, userSettings, variations } from "@/server/db/schema";
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

  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).default(40),
        localDate: isoDateSchema.optional(),
        cursor: z
          .object({
            occurredAt: z.string().datetime(),
            id: z.string().uuid(),
          })
          .optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const cursor = input.cursor;
      const cursorAt = cursor ? new Date(cursor.occurredAt) : null;

      const rows = await ctx.db
        .select({
          id: pushSets.id,
          variationId: pushSets.variationId,
          variationName: variations.name,
          reps: pushSets.reps,
          occurredAt: pushSets.occurredAt,
          localDate: pushSets.localDate,
          note: pushSets.note,
          intensityFactor: variations.intensityFactor,
        })
        .from(pushSets)
        .innerJoin(variations, eq(pushSets.variationId, variations.id))
        .where(
          and(
            eq(pushSets.userId, ctx.userId),
            isNull(pushSets.deletedAt),
            input.localDate ? eq(pushSets.localDate, input.localDate) : undefined,
            cursorAt && cursor
              ? or(
                  lt(pushSets.occurredAt, cursorAt),
                  and(eq(pushSets.occurredAt, cursorAt), lt(pushSets.id, cursor.id)),
                )
              : undefined,
          ),
        )
        .orderBy(desc(pushSets.occurredAt), desc(pushSets.id))
        .limit(input.limit + 1);

      const hasMore = rows.length > input.limit;
      const items = hasMore ? rows.slice(0, input.limit) : rows;
      const last = items[items.length - 1];

      return {
        items: items.map((row) => ({
          ...row,
          occurredAt: row.occurredAt.toISOString(),
        })),
        nextCursor:
          hasMore && last
            ? { occurredAt: last.occurredAt.toISOString(), id: last.id }
            : null,
      };
    }),

  update: protectedProcedure
    .input(
      z
        .object({
          id: z.string().uuid(),
          variationId: z.string().min(1).optional(),
          reps: z.number().int().min(1).max(500).optional(),
          note: z.string().max(500).nullable().optional(),
        })
        .refine(
          (value) =>
            value.variationId !== undefined ||
            value.reps !== undefined ||
            value.note !== undefined,
          { message: "At least one field to update is required." },
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select()
        .from(pushSets)
        .where(
          and(
            eq(pushSets.id, input.id),
            eq(pushSets.userId, ctx.userId),
            isNull(pushSets.deletedAt),
          ),
        );

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found." });
      }

      if (input.variationId !== undefined) {
        const [variation] = await ctx.db
          .select({ id: variations.id })
          .from(variations)
          .where(eq(variations.id, input.variationId));
        if (!variation) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Unknown variation.",
          });
        }
      }

      const [updated] = await ctx.db
        .update(pushSets)
        .set({
          ...(input.variationId !== undefined
            ? { variationId: input.variationId }
            : {}),
          ...(input.reps !== undefined ? { reps: input.reps } : {}),
          ...(input.note !== undefined ? { note: input.note } : {}),
          updatedAt: new Date(),
        })
        .where(eq(pushSets.id, input.id))
        .returning();

      await recomputeDailyStats(ctx.db, ctx.userId, existing.localDate);
      return updated;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({
          id: pushSets.id,
          localDate: pushSets.localDate,
          deletedAt: pushSets.deletedAt,
        })
        .from(pushSets)
        .where(and(eq(pushSets.id, input.id), eq(pushSets.userId, ctx.userId)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Set not found." });
      }

      if (!existing.deletedAt) {
        await ctx.db
          .update(pushSets)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(eq(pushSets.id, input.id));
        await recomputeDailyStats(ctx.db, ctx.userId, existing.localDate);
      }

      return { id: existing.id };
    }),
});
