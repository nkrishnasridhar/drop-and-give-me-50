import { addDays, enumerateDates, startOfWeekMonday } from "@/domain/date";
import { countCompletedDays, type DayStatus } from "@/domain/streak";

export const CONSISTENCY_WEEKS = 12;

export interface ConsistencyRate {
  met: number;
  considered: number;
  rate: number;
}

/**
 * North Star: share of trailing weeks that hit `weeklyTargetDays`.
 * Counts at most the last 12 Monday–Sunday blocks that exist since the
 * first logged day. An unmet in-progress week is excluded so mid-week
 * gaps don't look like failure (same rule as the week-streak).
 */
export function computeConsistencyRate(input: {
  days: Iterable<DayStatus>;
  today: string;
  weeklyTargetDays: number;
}): ConsistencyRate {
  const target = Math.max(1, Math.min(7, input.weeklyTargetDays));
  const byDate = new Map<string, DayStatus>();
  let earliest = input.today;
  let hasHistory = false;
  for (const day of input.days) {
    byDate.set(day.localDate, day);
    if (!hasHistory || day.localDate < earliest) earliest = day.localDate;
    hasHistory = true;
  }

  const thisWeekStart = startOfWeekMonday(input.today);
  if (!hasHistory) {
    return { met: 0, considered: 0, rate: 0 };
  }

  const firstWeekStart = startOfWeekMonday(earliest);
  let met = 0;
  let considered = 0;
  for (let i = 0; i < CONSISTENCY_WEEKS; i += 1) {
    const weekStart = addDays(thisWeekStart, -7 * i);
    if (weekStart < firstWeekStart) break;
    const dates = enumerateDates(weekStart, addDays(weekStart, 6));
    const completed = countCompletedDays(byDate, dates);
    const hit = completed >= target;
    const inProgress = weekStart === thisWeekStart;
    if (inProgress && !hit) continue;
    considered += 1;
    if (hit) met += 1;
  }

  return {
    met,
    considered,
    rate: considered === 0 ? 0 : met / considered,
  };
}

export function averageRepsPerSet(totalReps: number, setCount: number): number {
  if (setCount <= 0) return 0;
  return totalReps / setCount;
}

export interface FamilyTotal {
  family: string;
  reps: number;
  volumeLoad: number;
}

export function variationBreakdown(
  sets: Iterable<{ family: string; reps: number; volumeLoad: number }>,
): FamilyTotal[] {
  const byFamily = new Map<string, FamilyTotal>();
  for (const set of sets) {
    const current = byFamily.get(set.family) ?? {
      family: set.family,
      reps: 0,
      volumeLoad: 0,
    };
    current.reps += set.reps;
    current.volumeLoad += set.volumeLoad;
    byFamily.set(set.family, current);
  }
  return [...byFamily.values()].sort((a, b) => b.reps - a.reps);
}

export function hourHistogram(
  hours: Iterable<number>,
): number[] {
  const buckets = Array.from({ length: 24 }, () => 0);
  for (const hour of hours) {
    if (hour >= 0 && hour <= 23) buckets[hour] += 1;
  }
  return buckets;
}

export function biggestDay(
  days: Iterable<DayStatus>,
): { localDate: string; totalReps: number; volumeLoad: number } | null {
  let best: { localDate: string; totalReps: number; volumeLoad: number } | null =
    null;
  for (const day of days) {
    if (day.totalReps <= 0) continue;
    if (
      !best ||
      day.totalReps > best.totalReps ||
      (day.totalReps === best.totalReps && day.volumeLoad > best.volumeLoad)
    ) {
      best = {
        localDate: day.localDate,
        totalReps: day.totalReps,
        volumeLoad: day.volumeLoad,
      };
    }
  }
  return best;
}
