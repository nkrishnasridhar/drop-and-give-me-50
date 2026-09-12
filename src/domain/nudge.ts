export const LIFETIME_MILESTONES = [
  50, 100, 500, 1000, 2500, 5000, 10_000,
] as const;

export type LogToastId =
  | "lifetime"
  | "biggest-set"
  | "biggest-day"
  | "daily-goal"
  | "week-target";

export interface LogToast {
  id: LogToastId;
  message: string;
}

/**
 * One toast per log, derived from the totals around that write — never
 * stored (docs/decisions.md #8). Badges stay Version 2.
 */
export function selectLogToast(input: {
  reps: number;
  previousTodayReps: number;
  dailyRepGoal: number;
  previousWeekActive: number;
  weeklyTargetDays: number;
  todayAlreadyComplete: boolean;
  previousBiggestSet: number | null;
  previousBiggestDay: number | null;
  previousLifetimeReps: number | null;
}): LogToast | null {
  const nextToday = input.previousTodayReps + input.reps;
  const nextLifetime =
    input.previousLifetimeReps === null
      ? null
      : input.previousLifetimeReps + input.reps;
  const nextWeekActive = input.todayAlreadyComplete
    ? input.previousWeekActive
    : input.previousWeekActive + 1;

  if (nextLifetime !== null) {
    const crossed = LIFETIME_MILESTONES.find(
      (mark) => input.previousLifetimeReps! < mark && nextLifetime >= mark,
    );
    if (crossed !== undefined) {
      return {
        id: "lifetime",
        message: `${crossed.toLocaleString("en-US")} lifetime. It counts because you did it.`,
      };
    }
  }

  if (
    input.previousBiggestSet !== null &&
    input.previousBiggestSet > 0 &&
    input.reps > input.previousBiggestSet
  ) {
    return {
      id: "biggest-set",
      message: `New biggest set · ${input.reps}`,
    };
  }

  if (
    input.previousBiggestDay !== null &&
    input.previousBiggestDay > 0 &&
    nextToday > input.previousBiggestDay
  ) {
    return {
      id: "biggest-day",
      message: `Biggest day yet · ${nextToday}`,
    };
  }

  if (
    input.dailyRepGoal > 0 &&
    input.previousTodayReps < input.dailyRepGoal &&
    nextToday >= input.dailyRepGoal
  ) {
    return {
      id: "daily-goal",
      message: `Daily ${input.dailyRepGoal} is on the board.`,
    };
  }

  if (
    input.weeklyTargetDays > 0 &&
    input.previousWeekActive < input.weeklyTargetDays &&
    nextWeekActive >= input.weeklyTargetDays
  ) {
    return {
      id: "week-target",
      message: "Week's in. Rest is still allowed.",
    };
  }

  return null;
}
