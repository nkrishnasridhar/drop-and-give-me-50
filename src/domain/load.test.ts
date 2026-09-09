import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import {
  computeLoad,
  rampScenarioDays,
  RAMP_RATIO_THRESHOLD,
  selectEducationalCard,
} from "./load";
import type { DayStatus } from "./streak";

function day(
  localDate: string,
  partial: Partial<DayStatus> = {},
): DayStatus {
  return {
    localDate,
    setCount: 1,
    totalReps: 20,
    volumeLoad: 20,
    isRestDay: false,
    ...partial,
  };
}

describe("computeLoad", () => {
  it("returns a ratio near 1 when volume is steady", () => {
    const today = "2024-06-28";
    const days = Array.from({ length: 28 }, (_, index) =>
      day(addDays(today, -(27 - index))),
    );
    const load = computeLoad({ days, today });
    expect(load.acuteLoad).toBe(140);
    expect(load.chronicWeeklyLoad).toBe(140);
    expect(load.ratio).toBe(1);
  });

  it("has no ratio when the chronic window is empty", () => {
    const load = computeLoad({ days: [], today: "2024-06-12" });
    expect(load.ratio).toBeNull();
    expect(load.acuteLoad).toBe(0);
  });
});

describe("rampScenarioDays", () => {
  it("produces a ratio above the visible 1.5× threshold", () => {
    const today = "2024-06-28";
    const days = rampScenarioDays(today);
    const load = computeLoad({ days, today });
    expect(load.ratio).toBeGreaterThan(RAMP_RATIO_THRESHOLD);
    expect(selectEducationalCard({ days, today, ratio: load.ratio })).toBe(
      "ramp",
    );
  });
});

describe("selectEducationalCard", () => {
  it("does not fire ramp below the threshold", () => {
    const today = "2024-06-28";
    const days = Array.from({ length: 28 }, (_, index) =>
      day(addDays(today, -(27 - index))),
    );
    const load = computeLoad({ days, today });
    expect(selectEducationalCard({ days, today, ratio: load.ratio })).not.toBe(
      "ramp",
    );
  });

  it("fires shoulder on a 150-rep day when the ramp is quiet", () => {
    const today = "2024-06-12";
    const days = [day(today, { totalReps: 150, volumeLoad: 150 })];
    expect(selectEducationalCard({ days, today, ratio: null })).toBe("shoulder");
  });

  it("fires pull after four training days when nothing more urgent is on", () => {
    const today = "2024-06-12";
    const days = [0, 1, 2, 3].map((ago) => day(addDays(today, -ago)));
    expect(selectEducationalCard({ days, today, ratio: 1 })).toBe("pull");
  });

  it("does not treat rest days as pull-card training days", () => {
    const today = "2024-06-12";
    const days = [0, 1, 2, 3].map((ago) =>
      day(addDays(today, -ago), {
        setCount: 0,
        totalReps: 0,
        volumeLoad: 0,
        isRestDay: true,
      }),
    );
    expect(selectEducationalCard({ days, today, ratio: 1 })).toBeNull();
  });

  it("prefers shoulder over pull when both would apply", () => {
    const today = "2024-06-12";
    const days = [0, 1, 2, 3].map((ago) =>
      day(addDays(today, -ago), ago === 0 ? { totalReps: 150 } : {}),
    );
    expect(selectEducationalCard({ days, today, ratio: 1 })).toBe("shoulder");
  });

  it("does not fire ramp until seven days in the 28-day window have volume", () => {
    const today = "2024-06-12";
    const days = Array.from({ length: 6 }, (_, ago) =>
      day(addDays(today, -ago), { volumeLoad: 80, totalReps: 80 }),
    );
    const load = computeLoad({ days, today });
    expect(load.ratio).toBeGreaterThan(RAMP_RATIO_THRESHOLD);
    expect(selectEducationalCard({ days, today, ratio: load.ratio })).not.toBe(
      "ramp",
    );
  });

  it("prefers ramp over shoulder when both would apply", () => {
    const today = "2024-06-28";
    const days = rampScenarioDays(today).map((row) =>
      row.localDate === today ? { ...row, totalReps: 150 } : row,
    );
    const load = computeLoad({ days, today });
    expect(selectEducationalCard({ days, today, ratio: load.ratio })).toBe(
      "ramp",
    );
  });
});
