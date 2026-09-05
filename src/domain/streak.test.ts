import { describe, expect, it } from "vitest";
import { addDays, enumerateDates, startOfWeekMonday } from "./date";
import { computeWeekStreak, withPendingToday, type DayStatus } from "./streak";

function trained(localDate: string): DayStatus {
  return {
    localDate,
    setCount: 1,
    totalReps: 20,
    volumeLoad: 20,
    isRestDay: false,
  };
}

function rest(localDate: string): DayStatus {
  return {
    localDate,
    setCount: 0,
    totalReps: 0,
    volumeLoad: 0,
    isRestDay: true,
  };
}

/** First five weekdays of the Monday-start week containing `today`. */
function fiveWeekdays(today: string): DayStatus[] {
  const monday = startOfWeekMonday(today);
  return enumerateDates(monday, addDays(monday, 4)).map(trained);
}

describe("computeWeekStreak", () => {
  const wednesday = "2024-06-12"; // week of 2024-06-10

  it("returns zeros when there is no history", () => {
    const result = computeWeekStreak({
      days: [],
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(result).toMatchObject({
      current: 0,
      longest: 0,
      thisWeekCompleted: 0,
      thisWeekMet: false,
      thisWeekStart: "2024-06-10",
    });
  });

  it("counts an in-progress week only after it has already met the target", () => {
    const thisWeekPartial = enumerateDates("2024-06-10", "2024-06-11").map(
      trained,
    );
    const lastWeek = fiveWeekdays("2024-06-05");
    const twoWeeksAgo = fiveWeekdays("2024-05-29");

    const inProgress = computeWeekStreak({
      days: [...twoWeeksAgo, ...lastWeek, ...thisWeekPartial],
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(inProgress.thisWeekCompleted).toBe(2);
    expect(inProgress.thisWeekMet).toBe(false);
    expect(inProgress.current).toBe(2);

    const metThisWeek = computeWeekStreak({
      days: [...twoWeeksAgo, ...lastWeek, ...fiveWeekdays(wednesday)],
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(metThisWeek.thisWeekMet).toBe(true);
    expect(metThisWeek.current).toBe(3);
  });

  it("treats an explicit rest day as a completed day", () => {
    const monday = startOfWeekMonday(wednesday);
    const days = [
      trained(monday),
      trained(addDays(monday, 1)),
      rest(addDays(monday, 2)),
      trained(addDays(monday, 3)),
      rest(addDays(monday, 4)),
    ];
    const result = computeWeekStreak({
      days,
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(result.thisWeekCompleted).toBe(5);
    expect(result.thisWeekMet).toBe(true);
    expect(result.current).toBe(1);
  });

  it("breaks the current chain on a missed week but keeps the longest", () => {
    const older = fiveWeekdays("2024-05-20"); // week of 05-20
    const older2 = fiveWeekdays("2024-05-27");
    const missed = "2024-06-05"; // week of 06-03, no days
    const result = computeWeekStreak({
      days: [...older, ...older2, trained(missed)],
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it("ignores a day whose sets were deleted (zero setCount, not rest)", () => {
    const monday = startOfWeekMonday(wednesday);
    const days: DayStatus[] = [
      trained(monday),
      {
        localDate: addDays(monday, 1),
        setCount: 0,
        totalReps: 0,
        volumeLoad: 0,
        isRestDay: false,
      },
      trained(addDays(monday, 2)),
      trained(addDays(monday, 3)),
      trained(addDays(monday, 4)),
    ];
    const result = computeWeekStreak({
      days,
      today: wednesday,
      weeklyTargetDays: 5,
    });
    expect(result.thisWeekCompleted).toBe(4);
    expect(result.thisWeekMet).toBe(false);
  });
});

describe("withPendingToday", () => {
  it("adds today only when a pending log hasn't landed in the snapshot", () => {
    expect(withPendingToday(["2024-06-10"], "2024-06-12", true)).toEqual([
      "2024-06-10",
      "2024-06-12",
    ]);
    expect(withPendingToday(["2024-06-12"], "2024-06-12", true)).toEqual([
      "2024-06-12",
    ]);
    expect(withPendingToday(["2024-06-10"], "2024-06-12", false)).toEqual([
      "2024-06-10",
    ]);
  });
});
