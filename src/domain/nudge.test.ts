import { describe, expect, it } from "vitest";
import { selectLogToast } from "./nudge";

const base = {
  reps: 20,
  previousTodayReps: 10,
  dailyRepGoal: 50,
  previousWeekActive: 2,
  weeklyTargetDays: 5,
  todayAlreadyComplete: true,
  previousBiggestSet: 40,
  previousBiggestDay: 80,
  previousLifetimeReps: 200,
};

describe("selectLogToast", () => {
  it("returns nothing for an ordinary set", () => {
    expect(selectLogToast(base)).toBeNull();
  });

  it("fires a lifetime milestone ahead of a set PR", () => {
    const toast = selectLogToast({
      ...base,
      reps: 50,
      previousBiggestSet: 40,
      previousLifetimeReps: 480,
    });
    expect(toast?.id).toBe("lifetime");
    expect(toast?.message).toContain("500");
  });

  it("fires a biggest-set PR", () => {
    expect(
      selectLogToast({ ...base, reps: 41, previousBiggestSet: 40 })?.id,
    ).toBe("biggest-set");
  });

  it("does not treat the first set as a PR", () => {
    expect(
      selectLogToast({
        ...base,
        reps: 20,
        previousBiggestSet: 0,
        previousBiggestDay: 0,
        previousLifetimeReps: 0,
        previousTodayReps: 0,
        dailyRepGoal: 50,
        previousWeekActive: 0,
        todayAlreadyComplete: false,
        weeklyTargetDays: 5,
      }),
    ).toBeNull();
  });

  it("fires a biggest-day PR", () => {
    expect(
      selectLogToast({
        ...base,
        reps: 20,
        previousTodayReps: 70,
        previousBiggestDay: 80,
      })?.id,
    ).toBe("biggest-day");
  });

  it("fires when the log crosses the daily goal", () => {
    expect(
      selectLogToast({
        ...base,
        reps: 20,
        previousTodayReps: 40,
        dailyRepGoal: 50,
        previousBiggestSet: 40,
        previousBiggestDay: 200,
        previousLifetimeReps: 200,
      })?.id,
    ).toBe("daily-goal");
  });

  it("fires when the week target is locked in", () => {
    expect(
      selectLogToast({
        ...base,
        previousWeekActive: 4,
        weeklyTargetDays: 5,
        todayAlreadyComplete: false,
        previousBiggestDay: 200,
        previousLifetimeReps: 200,
      })?.id,
    ).toBe("week-target");
  });

  it("skips lifetime and PRs when overview stats are unknown", () => {
    expect(
      selectLogToast({
        ...base,
        previousBiggestSet: null,
        previousBiggestDay: null,
        previousLifetimeReps: null,
      }),
    ).toBeNull();
  });
});
