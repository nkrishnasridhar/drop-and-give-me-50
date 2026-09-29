import { addDays, enumerateDates, startOfWeekMonday } from "@/domain/date";

export interface DayStatus {
  localDate: string;
  setCount: number;
  totalReps: number;
  volumeLoad: number;
  isRestDay: boolean;
}

export function isCompletedDay(day: DayStatus | undefined): boolean {
  if (!day) return false;
  return day.setCount > 0 || day.isRestDay;
}

export function countCompletedDays(
  days: ReadonlyMap<string, DayStatus>,
  dates: readonly string[],
): number {
  let count = 0;
  for (const date of dates) {
    if (isCompletedDay(days.get(date))) count += 1;
  }
  return count;
}

export interface WeekStreak {
  current: number;
  longest: number;
  thisWeekCompleted: number;
  thisWeekTarget: number;
  thisWeekMet: boolean;
  thisWeekStart: string;
}

/**
 * Weekly streak: consecutive Monday–Sunday blocks that met
 * `weeklyTargetDays` completed days (sets or an explicit rest day).
 * The in-progress week is included only once it has already met the
 * target — missing days still ahead never break last week's chain
 * (docs/decisions.md #4).
 */
export function computeWeekStreak(input: {
  days: Iterable<DayStatus>;
  today: string;
  weeklyTargetDays: number;
}): WeekStreak {
  const target = Math.max(1, Math.min(7, input.weeklyTargetDays));
  const thisWeekStart = startOfWeekMonday(input.today);
  const byDate = new Map<string, DayStatus>();
  let earliest = input.today;

  for (const day of input.days) {
    byDate.set(day.localDate, day);
    if (day.localDate < earliest) earliest = day.localDate;
  }

  const thisWeekDates = enumerateDates(thisWeekStart, addDays(thisWeekStart, 6));
  const thisWeekCompleted = countCompletedDays(byDate, thisWeekDates);
  const thisWeekMet = thisWeekCompleted >= target;

  if (byDate.size === 0) {
    return {
      current: 0,
      longest: 0,
      thisWeekCompleted,
      thisWeekTarget: target,
      thisWeekMet,
      thisWeekStart,
    };
  }

  const firstWeekStart = startOfWeekMonday(earliest);
  const met: boolean[] = [];
  for (
    let weekStart = firstWeekStart;
    weekStart <= thisWeekStart;
    weekStart = addDays(weekStart, 7)
  ) {
    const dates = enumerateDates(weekStart, addDays(weekStart, 6));
    met.push(countCompletedDays(byDate, dates) >= target);
  }

  let longest = 0;
  let run = 0;
  for (const didMeet of met) {
    if (didMeet) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  // Current chain: walk backwards. Skip an unmet in-progress week.
  let current = 0;
  let index = met.length - 1;
  if (index >= 0 && !met[index]) {
    index -= 1;
  }
  while (index >= 0 && met[index]) {
    current += 1;
    index -= 1;
  }

  return {
    current,
    longest,
    thisWeekCompleted,
    thisWeekTarget: target,
    thisWeekMet,
    thisWeekStart,
  };
}

/** Pending local logs complete today before `days.today` has caught up. */
export function withPendingToday(
  completedDates: readonly string[],
  today: string,
  pendingToday: boolean,
): string[] {
  if (!pendingToday || completedDates.includes(today)) {
    return [...completedDates];
  }
  return [...completedDates, today];
}

export type WeekDotKind = "rest" | "filled" | "future" | "empty";

/** Log week-ring dot style: rest days share History's green, not the accent fill. */
export function weekDotKind(input: {
  date: string;
  today: string;
  completedDates: readonly string[];
  restDates: readonly string[];
}): WeekDotKind {
  if (input.date > input.today) return "future";
  if (input.restDates.includes(input.date)) return "rest";
  if (input.completedDates.includes(input.date)) return "filled";
  return "empty";
}
