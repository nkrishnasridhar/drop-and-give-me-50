import { describe, expect, it } from "vitest";
import {
  addDayCounts,
  pendingDayCount,
  raiseTodayFloor,
  visibleTodayTotals,
} from "./today-totals";

const zero = { totalReps: 0, setCount: 0 };

describe("visibleTodayTotals", () => {
  it("adds pending outbox rows onto the last server snapshot", () => {
    expect(
      visibleTodayTotals(
        { totalReps: 10, setCount: 1 },
        { totalReps: 15, setCount: 1 },
        null,
      ),
    ).toEqual({ totalReps: 25, setCount: 2 });
  });

  it("keeps the last shown total after drain while the snapshot is still stale", () => {
    const floor = raiseTodayFloor(null, { totalReps: 10, setCount: 1 });

    expect(visibleTodayTotals(zero, zero, floor)).toEqual({
      totalReps: 10,
      setCount: 1,
    });
  });

  it("does not double-count once the server snapshot includes the set", () => {
    const floor = { totalReps: 10, setCount: 1 };

    expect(
      visibleTodayTotals({ totalReps: 10, setCount: 1 }, zero, floor),
    ).toEqual({ totalReps: 10, setCount: 1 });
  });

  it("raises the floor across two logs so a stale snapshot of the first cannot dip", () => {
    const afterFirst = raiseTodayFloor(null, { totalReps: 10, setCount: 1 });
    const afterSecond = raiseTodayFloor(afterFirst, {
      totalReps: 25,
      setCount: 2,
    });

    expect(
      visibleTodayTotals({ totalReps: 10, setCount: 1 }, zero, afterSecond),
    ).toEqual({ totalReps: 25, setCount: 2 });
  });
});

describe("pendingDayCount", () => {
  it("sums reps and counts rows", () => {
    expect(pendingDayCount([{ reps: 10 }, { reps: 15 }])).toEqual({
      totalReps: 25,
      setCount: 2,
    });
  });
});

describe("addDayCounts", () => {
  it("adds both fields", () => {
    expect(
      addDayCounts({ totalReps: 10, setCount: 1 }, { totalReps: 15, setCount: 1 }),
    ).toEqual({ totalReps: 25, setCount: 2 });
  });
});
