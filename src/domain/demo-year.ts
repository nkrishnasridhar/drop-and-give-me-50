import { addDays, enumerateDates, weekdayMonday0 } from "@/domain/date";

/**
 * Note written on every seeded demo set / rest day so the fixture is
 * identifiable and skippable. Same pattern as the ramp seed's
 * `"ramp-fixture"` — not a second API or a fake in-app data path.
 */
export const DEMO_NOTE = "demo-year";

/** Inclusive civil-date span ending yesterday, so today stays free to log. */
export const DEMO_SPAN_DAYS = 365;

/**
 * Variation ids that exist in `scripts/seed-variations.ts`. Weighted toward
 * regular so the heatmap reads as a real habit, with enough mix for Stats.
 */
export const DEMO_VARIATIONS = [
  "regular",
  "regular",
  "regular",
  "knee",
  "wide",
  "tricep",
  "diamond",
  "decline",
  "close-grip",
  "pike",
] as const;

export type DemoSet = {
  variationId: string;
  reps: number;
  hour: number;
  minute: number;
};

export type DemoDay =
  | { localDate: string; kind: "train"; sets: DemoSet[] }
  | { localDate: string; kind: "rest" }
  | { localDate: string; kind: "off" };

export type DemoYearSummary = {
  days: number;
  train: number;
  rest: number;
  off: number;
  sets: number;
  reps: number;
  variations: string[];
  firstDate: string;
  lastDate: string;
};

const HOUR_SLOTS = [7, 8, 12, 18, 19, 20] as const;

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function pickInt(rand: () => number, min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}

function pickOne<T>(rand: () => number, items: readonly T[]): T {
  const item = items[Math.floor(rand() * items.length)];
  if (item === undefined) {
    throw new Error("Cannot pick from an empty list.");
  }
  return item;
}

/**
 * A year that looks lived-in: five-day weeks most of the time, some missed
 * weeks, rest days that count, and volume that ramps then holds so the
 * load card stays quiet. Deterministic for a given `today` + `seed`.
 */
export function buildDemoYear(
  today: string,
  seed = 50,
): DemoDay[] {
  const last = addDays(today, -1);
  const first = addDays(today, -DEMO_SPAN_DAYS);
  const dates = enumerateDates(first, last);
  const rand = mulberry32(seed);
  const peakIndex = Math.min(
    dates.length - 1,
    Math.max(0, Math.floor(dates.length * 0.68)),
  );

  return dates.map((localDate, index) => {
    const weekday = weekdayMonday0(localDate);
    const weekIndex = Math.floor(index / 7);
    const progress = index / Math.max(1, dates.length - 1);

    if (weekIndex % 13 === 12) {
      if (weekday === 2) {
        return trainDay(localDate, rand, progress, 1, 16);
      }
      return { localDate, kind: "off" };
    }

    if (weekIndex % 6 === 5) {
      if (weekday === 0 || weekday === 2) {
        return trainDay(localDate, rand, progress, 1, 18);
      }
      if (weekday === 3) return { localDate, kind: "rest" };
      return { localDate, kind: "off" };
    }

    if (weekday === 3) return { localDate, kind: "rest" };
    if (weekday === 5 || weekday === 6) return { localDate, kind: "off" };

    const setCount = index === peakIndex ? 5 : pickInt(rand, 1, progress > 0.45 ? 3 : 2);
    const baseReps = index === peakIndex ? 25 : 0;
    return trainDay(localDate, rand, progress, setCount, baseReps);
  });
}

function trainDay(
  localDate: string,
  rand: () => number,
  progress: number,
  setCount: number,
  forcedReps: number,
): DemoDay {
  const plateau = progress < 0.75 ? 0.72 + progress * 0.37 : 1;
  const sets: DemoSet[] = [];
  const usedHours = new Set<number>();

  for (let index = 0; index < setCount; index += 1) {
    let hour = pickOne(rand, HOUR_SLOTS);
    if (usedHours.has(hour) && usedHours.size < HOUR_SLOTS.length) {
      hour = pickOne(
        rand,
        HOUR_SLOTS.filter((slot) => !usedHours.has(slot)),
      );
    }
    usedHours.add(hour);

    const variationId =
      progress < 0.2 && rand() < 0.35
        ? "knee"
        : pickOne(rand, DEMO_VARIATIONS);
    const reps =
      forcedReps > 0
        ? forcedReps
        : Math.max(
            8,
            Math.round((12 + progress * 10) * plateau + pickInt(rand, -2, 4)),
          );

    sets.push({
      variationId,
      reps: Math.min(50, reps),
      hour,
      minute: pickInt(rand, 0, 59),
    });
  }

  sets.sort((a, b) => a.hour - b.hour || a.minute - b.minute);
  return { localDate, kind: "train", sets };
}

export function summarizeDemoYear(days: readonly DemoDay[]): DemoYearSummary {
  let train = 0;
  let rest = 0;
  let off = 0;
  let sets = 0;
  let reps = 0;
  const variations = new Set<string>();

  for (const day of days) {
    if (day.kind === "train") {
      train += 1;
      sets += day.sets.length;
      for (const set of day.sets) {
        reps += set.reps;
        variations.add(set.variationId);
      }
    } else if (day.kind === "rest") {
      rest += 1;
    } else {
      off += 1;
    }
  }

  const first = days[0];
  const last = days[days.length - 1];
  if (!first || !last) {
    throw new Error("Demo year must contain at least one day.");
  }

  return {
    days: days.length,
    train,
    rest,
    off,
    sets,
    reps,
    variations: [...variations].sort(),
    firstDate: first.localDate,
    lastDate: last.localDate,
  };
}
