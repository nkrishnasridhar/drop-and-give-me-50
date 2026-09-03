import { describe, expect, it } from "vitest";
import {
  addDayCounts,
  nextTodayFloor,
  pendingDayCount,
  raiseTodayFloor,
  visibleTodayTotals,
} from "./today-totals";

const zero = { totalReps: 0, setCount: 0 };
const server105 = { totalReps: 105, setCount: 7 };
const pending60 = { totalReps: 60, setCount: 3 };
const floor165 = { totalReps: 165, setCount: 10 };

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

  it("does not treat a missing snapshot as an empty day while the outbox is loaded", () => {
    expect(visibleTodayTotals(null, pending60, null)).toEqual(pending60);
    expect(visibleTodayTotals(null, pending60, floor165)).toEqual(floor165);
  });

  it("does not add queued sets on top of a snapshot that already includes some of them", () => {
    expect(
      visibleTodayTotals({ totalReps: 125, setCount: 8 }, pending60, floor165),
    ).toEqual(floor165);
    expect(
      visibleTodayTotals({ totalReps: 165, setCount: 10 }, pending60, floor165),
    ).toEqual(floor165);
  });
});

describe("nextTodayFloor", () => {
  it("raises the floor by the newly queued delta, not by live server + all pending", () => {
    const afterFirst = nextTodayFloor({
      floor: null,
      server: server105,
      previousPending: zero,
      pending: { totalReps: 20, setCount: 1 },
      hydration: false,
    });
    const afterSecond = nextTodayFloor({
      floor: afterFirst,
      server: server105,
      previousPending: { totalReps: 20, setCount: 1 },
      pending: { totalReps: 40, setCount: 2 },
      hydration: false,
    });
    const afterThird = nextTodayFloor({
      floor: afterSecond,
      server: server105,
      previousPending: { totalReps: 40, setCount: 2 },
      pending: pending60,
      hydration: false,
    });

    expect(afterFirst).toEqual({ totalReps: 125, setCount: 8 });
    expect(afterSecond).toEqual({ totalReps: 145, setCount: 9 });
    expect(afterThird).toEqual(floor165);
  });

  it("does not treat an IndexedDB rehydrate as three new logs", () => {
    expect(
      nextTodayFloor({
        floor: floor165,
        server: { totalReps: 125, setCount: 8 },
        previousPending: zero,
        pending: pending60,
        hydration: true,
      }),
    ).toEqual(floor165);
  });

  it("does not persist pending-only as a floor when the snapshot is still missing", () => {
    expect(
      nextTodayFloor({
        floor: null,
        server: null,
        previousPending: zero,
        pending: pending60,
        hydration: true,
      }),
    ).toBeNull();
  });

  it("holds the floor when pending shrinks during drain", () => {
    expect(
      nextTodayFloor({
        floor: floor165,
        server: { totalReps: 125, setCount: 8 },
        previousPending: pending60,
        pending: { totalReps: 40, setCount: 2 },
        hydration: false,
      }),
    ).toEqual(floor165);
  });
});

describe("offline reconnect sequence", () => {
  it("stays on 165/10 through remount and a partial drain snapshot", () => {
    let floor = nextTodayFloor({
      floor: null,
      server: server105,
      previousPending: zero,
      pending: { totalReps: 20, setCount: 1 },
      hydration: false,
    });
    floor = nextTodayFloor({
      floor,
      server: server105,
      previousPending: { totalReps: 20, setCount: 1 },
      pending: { totalReps: 40, setCount: 2 },
      hydration: false,
    });
    floor = nextTodayFloor({
      floor,
      server: server105,
      previousPending: { totalReps: 40, setCount: 2 },
      pending: pending60,
      hydration: false,
    });

    expect(visibleTodayTotals(server105, pending60, floor)).toEqual(floor165);

    const remountFloor = nextTodayFloor({
      floor,
      server: null,
      previousPending: zero,
      pending: pending60,
      hydration: true,
    });
    expect(visibleTodayTotals(null, pending60, remountFloor)).toEqual(
      floor165,
    );

    expect(
      visibleTodayTotals({ totalReps: 125, setCount: 8 }, pending60, remountFloor),
    ).toEqual(floor165);

    expect(visibleTodayTotals({ totalReps: 165, setCount: 10 }, zero, remountFloor)).toEqual(
      floor165,
    );
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
