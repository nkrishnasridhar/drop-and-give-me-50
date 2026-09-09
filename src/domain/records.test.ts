import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import {
  averageRepsPerSet,
  biggestDay,
  computeConsistencyRate,
  hourHistogram,
  variationBreakdown,
} from "./records";
import type { DayStatus } from "./streak";

function trained(localDate: string): DayStatus {
  return {
    localDate,
    setCount: 1,
    totalReps: 20,
    volumeLoad: 20,
    isRestDay: false,
  };
}

describe("computeConsistencyRate", () => {
  it("returns zeros with no history", () => {
    expect(
      computeConsistencyRate({
        days: [],
        today: "2024-06-12",
        weeklyTargetDays: 5,
      }),
    ).toEqual({ met: 0, considered: 0, rate: 0 });
  });

  it("excludes an unmet in-progress week from the denominator", () => {
    const today = "2024-06-12"; // Wednesday, week of 2024-06-10
    const lastWeek = [0, 1, 2, 3, 4].map((offset) =>
      trained(addDays("2024-06-03", offset)),
    );
    const thisWeek = [trained("2024-06-10"), trained("2024-06-11")];
    const result = computeConsistencyRate({
      days: [...lastWeek, ...thisWeek],
      today,
      weeklyTargetDays: 5,
    });
    expect(result.considered).toBe(1);
    expect(result.met).toBe(1);
    expect(result.rate).toBe(1);
  });

  it("includes the in-progress week once the target is already met", () => {
    const today = "2024-06-12";
    const result = computeConsistencyRate({
      days: [trained("2024-06-10"), trained("2024-06-11")],
      today,
      weeklyTargetDays: 2,
    });
    expect(result).toEqual({ met: 1, considered: 1, rate: 1 });
  });

  it("caps the window at 12 weeks even when more history exists", () => {
    const today = "2024-06-16"; // Sunday — this week can count
    const days: DayStatus[] = [];
    for (let week = 0; week < 14; week += 1) {
      const start = addDays("2024-06-10", -7 * week);
      for (let offset = 0; offset < 5; offset += 1) {
        days.push(trained(addDays(start, offset)));
      }
    }
    const result = computeConsistencyRate({
      days,
      today,
      weeklyTargetDays: 5,
    });
    expect(result.considered).toBe(12);
    expect(result.met).toBe(12);
    expect(result.rate).toBe(1);
  });
});

describe("averageRepsPerSet", () => {
  it("is zero when there are no sets", () => {
    expect(averageRepsPerSet(40, 0)).toBe(0);
  });

  it("divides lifetime reps by set count", () => {
    expect(averageRepsPerSet(100, 4)).toBe(25);
  });
});

describe("variationBreakdown", () => {
  it("sums reps by family, busiest first", () => {
    const rows = variationBreakdown([
      { family: "standard", reps: 10, volumeLoad: 10 },
      { family: "tricep", reps: 40, volumeLoad: 46 },
      { family: "standard", reps: 5, volumeLoad: 5 },
    ]);
    expect(rows[0]).toMatchObject({ family: "tricep", reps: 40 });
    expect(rows[1]).toMatchObject({ family: "standard", reps: 15 });
  });
});

describe("hourHistogram", () => {
  it("buckets 0–23", () => {
    const buckets = hourHistogram([7, 7, 18, 25, -1]);
    expect(buckets[7]).toBe(2);
    expect(buckets[18]).toBe(1);
    expect(buckets.reduce((sum, count) => sum + count, 0)).toBe(3);
  });
});

describe("biggestDay", () => {
  it("picks the highest-rep day", () => {
    const best = biggestDay([
      trained("2024-06-10"),
      { ...trained("2024-06-11"), totalReps: 80, volumeLoad: 80 },
    ]);
    expect(best).toMatchObject({ localDate: "2024-06-11", totalReps: 80 });
  });
});
