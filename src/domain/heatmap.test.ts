import { describe, expect, it } from "vitest";
import { heatmapLevel, heatmapMonthLabels, heatmapWeeks, maxVolume, type HeatLevel } from "./heatmap";
import type { DayStatus } from "./streak";

function day(partial: Partial<DayStatus> & { localDate: string }): DayStatus {
  return {
    setCount: 0,
    totalReps: 0,
    volumeLoad: 0,
    isRestDay: false,
    ...partial,
  };
}

describe("heatmapLevel", () => {
  it("returns empty for missing or zero-volume days", () => {
    expect(heatmapLevel(undefined, 100)).toBe(0);
    expect(heatmapLevel(day({ localDate: "2024-01-01" }), 100)).toBe(0);
  });

  it("marks a rest day with no reps as rest, not empty", () => {
    expect(
      heatmapLevel(day({ localDate: "2024-01-01", isRestDay: true }), 100),
    ).toBe("rest");
  });

  it("ramps 1–4 against the window's peak volume", () => {
    const peak = 100;
    const levels: HeatLevel[] = [
      heatmapLevel(day({ localDate: "a", volumeLoad: 10, totalReps: 10 }), peak),
      heatmapLevel(day({ localDate: "b", volumeLoad: 30, totalReps: 30 }), peak),
      heatmapLevel(day({ localDate: "c", volumeLoad: 60, totalReps: 60 }), peak),
      heatmapLevel(day({ localDate: "d", volumeLoad: 90, totalReps: 90 }), peak),
    ];
    expect(levels).toEqual([1, 2, 3, 4]);
  });
});

describe("heatmapWeeks", () => {
  it("builds Monday-start columns ending on this week's Sunday", () => {
    const weeks = heatmapWeeks("2024-06-12", 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0][0]).toBe("2024-06-03");
    expect(weeks[1][0]).toBe("2024-06-10");
    expect(weeks[1][6]).toBe("2024-06-16");
  });
});

describe("heatmapMonthLabels", () => {
  it("labels the first week of each month and skips cramped neighbours", () => {
    const weeks = heatmapWeeks("2024-06-12", 10);
    const labels = heatmapMonthLabels(weeks);
    expect(labels.some((entry) => entry.label === "Apr")).toBe(true);
    expect(labels.some((entry) => entry.label === "May")).toBe(true);
    expect(labels.some((entry) => entry.label === "Jun")).toBe(true);
    for (let i = 1; i < labels.length; i += 1) {
      expect(labels[i].weekIndex - labels[i - 1].weekIndex).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("maxVolume", () => {
  it("uses volumeLoad when present", () => {
    expect(
      maxVolume([
        day({ localDate: "a", volumeLoad: 12, totalReps: 8 }),
        day({ localDate: "b", volumeLoad: 40, totalReps: 50 }),
      ]),
    ).toBe(40);
  });
});
