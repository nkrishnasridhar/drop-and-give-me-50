import { and, eq, isNull } from "drizzle-orm";
import type { db as Db } from "@/server/db/client";
import { dailyStats, pushSets, restDays, variations } from "@/server/db/schema";

/**
 * Fully recomputes `daily_stats` for one user/day from `push_sets` (and
 * `rest_days`), rather than incrementally patching it. `daily_stats` is a
 * derived cache, never a source of truth (docs/decisions.md #8), so this
 * is always correct to call after any write that could affect that day —
 * a new set, an edit, a soft-delete, or (from Phase 3) a rest-day toggle.
 *
 * The per-day row count is always small (a handful of sets), so
 * recomputing from a full scan of that day is cheap and avoids
 * maintaining incremental aggregates that could drift.
 */
export async function recomputeDailyStats(
  db: typeof Db,
  userId: string,
  localDate: string,
): Promise<void> {
  const [restDay, sets] = await Promise.all([
    db
      .select({ localDate: restDays.localDate })
      .from(restDays)
      .where(and(eq(restDays.userId, userId), eq(restDays.localDate, localDate)))
      .then((rows) => rows[0]),
    db
      .select({
        reps: pushSets.reps,
        variationId: pushSets.variationId,
        occurredAt: pushSets.occurredAt,
        intensityFactor: variations.intensityFactor,
      })
      .from(pushSets)
      .innerJoin(variations, eq(pushSets.variationId, variations.id))
      .where(
        and(
          eq(pushSets.userId, userId),
          eq(pushSets.localDate, localDate),
          isNull(pushSets.deletedAt),
        ),
      ),
  ]);

  const isRestDay = Boolean(restDay);

  if (sets.length === 0) {
    await db
      .insert(dailyStats)
      .values({
        userId,
        localDate,
        totalReps: 0,
        setCount: 0,
        volumeLoad: 0,
        firstAt: null,
        lastAt: null,
        topVariationId: null,
        isRestDay,
      })
      .onConflictDoUpdate({
        target: [dailyStats.userId, dailyStats.localDate],
        set: {
          totalReps: 0,
          setCount: 0,
          volumeLoad: 0,
          firstAt: null,
          lastAt: null,
          topVariationId: null,
          isRestDay,
        },
      });
    return;
  }

  const repsByVariation = new Map<string, number>();
  let totalReps = 0;
  let volumeLoad = 0;
  let firstAt = sets[0].occurredAt;
  let lastAt = sets[0].occurredAt;

  for (const set of sets) {
    totalReps += set.reps;
    volumeLoad += set.reps * set.intensityFactor;
    repsByVariation.set(
      set.variationId,
      (repsByVariation.get(set.variationId) ?? 0) + set.reps,
    );
    if (set.occurredAt < firstAt) firstAt = set.occurredAt;
    if (set.occurredAt > lastAt) lastAt = set.occurredAt;
  }

  let topVariationId = sets[0].variationId;
  let topReps = -1;
  for (const [variationId, reps] of repsByVariation) {
    if (reps > topReps) {
      topReps = reps;
      topVariationId = variationId;
    }
  }

  await db
    .insert(dailyStats)
    .values({
      userId,
      localDate,
      totalReps,
      setCount: sets.length,
      volumeLoad,
      firstAt,
      lastAt,
      topVariationId,
      isRestDay,
    })
    .onConflictDoUpdate({
      target: [dailyStats.userId, dailyStats.localDate],
      set: {
        totalReps,
        setCount: sets.length,
        volumeLoad,
        firstAt,
        lastAt,
        topVariationId,
        isRestDay,
      },
    });
}
