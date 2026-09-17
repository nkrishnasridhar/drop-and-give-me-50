/**
 * Inserts a year of synthetic training for one user so History and Stats
 * have something to show. Skips if this user already has demo-year rows.
 * Requires DEMO_SEED_USER_ID (the Auth.js user uuid).
 *
 * Run with `npm run db:seed:demo`.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

const userId = process.env.DEMO_SEED_USER_ID;
if (!userId) {
  throw new Error("Set DEMO_SEED_USER_ID to the user uuid before seeding.");
}

const { and, eq } = await import("drizzle-orm");
const { computeLocalDate } = await import("@/domain/date");
const {
  buildDemoYear,
  DEMO_NOTE,
  summarizeDemoYear,
} = await import("@/domain/demo-year");
const { generateUuidV7 } = await import("@/lib/uuid");
const { db } = await import("@/server/db/client");
const { pushSets, restDays, userSettings, variations } = await import(
  "@/server/db/schema"
);
const { recomputeDailyStats } = await import("@/server/services/daily-stats");

const BATCH = 80;

const existing = await db
  .select({ id: pushSets.id })
  .from(pushSets)
  .where(and(eq(pushSets.userId, userId), eq(pushSets.note, DEMO_NOTE)))
  .limit(1);

const existingRest = await db
  .select({ localDate: restDays.localDate })
  .from(restDays)
  .where(and(eq(restDays.userId, userId), eq(restDays.note, DEMO_NOTE)))
  .limit(1);

if (existing.length > 0 || existingRest.length > 0) {
  console.log(`Demo year already present for ${userId}; skipping.`);
  process.exit(0);
}

const [knownVariation] = await db
  .select({ id: variations.id })
  .from(variations)
  .limit(1);

if (!knownVariation) {
  throw new Error("No variations found. Run `npm run db:seed` first.");
}

const [settings] = await db
  .select({ tz: userSettings.tz })
  .from(userSettings)
  .where(eq(userSettings.userId, userId));
const tz = settings?.tz ?? "UTC";
const today = computeLocalDate(new Date(), tz);
const days = buildDemoYear(today);
const summary = summarizeDemoYear(days);

type SetRow = {
  id: string;
  userId: string;
  variationId: string;
  reps: number;
  occurredAt: Date;
  localDate: string;
  tz: string;
  note: string;
  source: "backfill";
};

const setRows: SetRow[] = [];
const restRows: { userId: string; localDate: string; note: string }[] = [];
const dates = new Set<string>();

for (const day of days) {
  dates.add(day.localDate);
  if (day.kind === "rest") {
    restRows.push({ userId, localDate: day.localDate, note: DEMO_NOTE });
    continue;
  }
  if (day.kind !== "train") continue;

  for (const set of day.sets) {
    const hour = String(set.hour).padStart(2, "0");
    const minute = String(set.minute).padStart(2, "0");
    setRows.push({
      id: generateUuidV7(),
      userId,
      variationId: set.variationId,
      reps: set.reps,
      occurredAt: new Date(`${day.localDate}T${hour}:${minute}:00.000Z`),
      localDate: day.localDate,
      tz,
      note: DEMO_NOTE,
      source: "backfill",
    });
  }
}

for (let index = 0; index < setRows.length; index += BATCH) {
  await db.insert(pushSets).values(setRows.slice(index, index + BATCH));
}

for (let index = 0; index < restRows.length; index += BATCH) {
  await db.insert(restDays).values(restRows.slice(index, index + BATCH));
}

const uniqueDates = [...dates];
const concurrency = 5;
for (let index = 0; index < uniqueDates.length; index += concurrency) {
  const slice = uniqueDates.slice(index, index + concurrency);
  await Promise.all(
    slice.map((localDate) => recomputeDailyStats(db, userId, localDate)),
  );
}

console.log(
  `Seeded demo year for ${userId}: ${summary.train} training days, ${summary.rest} rest days, ${summary.off} gaps, ${summary.sets} sets, ${summary.reps} reps (${summary.firstDate} → ${summary.lastDate}).`,
);
