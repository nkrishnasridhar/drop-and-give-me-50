/**
 * Inserts a 21-day quiet + 7-day binge log for one user so the ramp card
 * has something to fire on. Skips if this user already has ramp-fixture
 * rows. Requires RAMP_SEED_USER_ID (the Auth.js user uuid).
 *
 * Run with `npm run db:seed:ramp`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const userId = process.env.RAMP_SEED_USER_ID;
if (!userId) {
  throw new Error("Set RAMP_SEED_USER_ID to the user uuid before seeding.");
}

const { and, eq } = await import("drizzle-orm");
const { addDays, computeLocalDate } = await import("@/domain/date");
const { ACUTE_DAYS, CHRONIC_DAYS } = await import("@/domain/load");
const { generateUuidV7 } = await import("@/lib/uuid");
const { db } = await import("@/server/db/client");
const { pushSets } = await import("@/server/db/schema");
const { recomputeDailyStats } = await import("@/server/services/daily-stats");

const existing = await db
  .select({ id: pushSets.id })
  .from(pushSets)
  .where(and(eq(pushSets.userId, userId), eq(pushSets.note, "ramp-fixture")))
  .limit(1);

if (existing.length > 0) {
  console.log(`Ramp fixture already present for ${userId}; skipping.`);
  process.exit(0);
}

const tz = "UTC";
const today = computeLocalDate(new Date(), tz);
const variationId = "regular";

for (let ago = CHRONIC_DAYS - 1; ago >= 0; ago -= 1) {
  const localDate = addDays(today, -ago);
  const binge = ago < ACUTE_DAYS;
  const reps = binge ? 80 : 20;
  const occurredAt = new Date(`${localDate}T12:00:00.000Z`);

  await db.insert(pushSets).values({
    id: generateUuidV7(),
    userId,
    variationId,
    reps,
    occurredAt,
    localDate,
    tz,
    note: "ramp-fixture",
    source: "backfill",
  });
  await recomputeDailyStats(db, userId, localDate);
}

console.log(`Seeded ${CHRONIC_DAYS} ramp-fixture sets for ${userId} ending ${today}.`);
