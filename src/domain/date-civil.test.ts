import { describe, expect, it } from "vitest";
import {
  addDays,
  enumerateDates,
  formatCivilDay,
  hourInZone,
  minutesInZone,
  startOfWeekMonday,
  weekdayMonday0,
} from "./date";

describe("civil date helpers", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2024-01-31", 1)).toBe("2024-02-01");
    expect(addDays("2023-12-31", 1)).toBe("2024-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("treats Monday as the start of the week (docs/decisions.md #4)", () => {
    expect(weekdayMonday0("2024-06-10")).toBe(0); // Monday
    expect(weekdayMonday0("2024-06-16")).toBe(6); // Sunday
    expect(startOfWeekMonday("2024-06-15")).toBe("2024-06-10");
    expect(startOfWeekMonday("2024-06-10")).toBe("2024-06-10");
  });

  it("enumerates an inclusive date range", () => {
    expect(enumerateDates("2024-06-10", "2024-06-12")).toEqual([
      "2024-06-10",
      "2024-06-11",
      "2024-06-12",
    ]);
    expect(enumerateDates("2024-06-12", "2024-06-10")).toEqual([]);
  });

  it("formats a stored civil date without timezone conversion", () => {
    // en-GB short weekday + short month, e.g. "Wed, 12 Jun"
    expect(formatCivilDay("2024-06-12")).toMatch(/Wed/);
    expect(formatCivilDay("2024-06-12")).toContain("12");
    expect(formatCivilDay("2024-06-12")).toContain("Jun");
    expect(formatCivilDay("2024-06-12")).not.toMatch(/Wednesday/i);
  });

  it("reads the wall-clock hour in a named zone", () => {
    const noonUtc = new Date("2024-01-15T12:00:00Z");
    expect(hourInZone(noonUtc, "UTC")).toBe(12);
    expect(hourInZone(noonUtc, "Pacific/Auckland")).toBe(1); // NZDT UTC+13
    expect(minutesInZone(noonUtc, "UTC")).toBe(12 * 60);
    expect(minutesInZone(noonUtc, "Pacific/Auckland")).toBe(60);
  });
});
