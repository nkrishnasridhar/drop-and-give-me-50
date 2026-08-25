import { describe, expect, it } from "vitest";
import { computeLocalDate } from "./date";

describe("computeLocalDate", () => {
  it("returns the calendar date in the given timezone with no offset", () => {
    expect(computeLocalDate(new Date("2024-06-15T20:00:00Z"), "UTC")).toBe(
      "2024-06-15",
    );
  });

  it("resolves Pacific/Auckland correctly in NZDT (summer, UTC+13)", () => {
    expect(
      computeLocalDate(new Date("2024-01-15T20:00:00Z"), "Pacific/Auckland"),
    ).toBe("2024-01-16");
  });

  it("resolves Pacific/Auckland correctly in NZST (winter, UTC+12)", () => {
    expect(
      computeLocalDate(new Date("2024-06-15T20:00:00Z"), "Pacific/Auckland"),
    ).toBe("2024-06-16");
  });

  describe("DST transitions are handled by the timezone database, not hardcoded offsets", () => {
    it("America/New_York spring-forward (2024-03-10, EST -> EDT)", () => {
      // 04:00Z is still EST (UTC-5) -> 2024-03-09 23:00 local
      expect(
        computeLocalDate(new Date("2024-03-10T04:00:00Z"), "America/New_York"),
      ).toBe("2024-03-09");
      // 09:00Z is after the 07:00Z transition, now EDT (UTC-4) -> 2024-03-10 05:00 local
      expect(
        computeLocalDate(new Date("2024-03-10T09:00:00Z"), "America/New_York"),
      ).toBe("2024-03-10");
    });

    it("America/New_York fall-back (2024-11-03, EDT -> EST)", () => {
      // 03:00Z is still EDT (UTC-4) -> 2024-11-02 23:00 local
      expect(
        computeLocalDate(new Date("2024-11-03T03:00:00Z"), "America/New_York"),
      ).toBe("2024-11-02");
      // 09:00Z is after the 06:00Z transition, now EST (UTC-5) -> 2024-11-03 04:00 local
      expect(
        computeLocalDate(new Date("2024-11-03T09:00:00Z"), "America/New_York"),
      ).toBe("2024-11-03");
    });
  });

  describe("day-start offset", () => {
    it("attributes a set logged before the offset cutoff to the previous day", () => {
      // 02:00 UTC with a 4-hour (240 minute) day-start offset behaves as
      // if the day hasn't started yet, so it belongs to the day before.
      expect(
        computeLocalDate(new Date("2024-06-15T02:00:00Z"), "UTC", 240),
      ).toBe("2024-06-14");
    });

    it("attributes a set logged after the offset cutoff to the current day", () => {
      expect(
        computeLocalDate(new Date("2024-06-15T05:00:00Z"), "UTC", 240),
      ).toBe("2024-06-15");
    });

    it("defaults to a zero offset (plain local midnight boundary)", () => {
      expect(computeLocalDate(new Date("2024-06-15T00:30:00Z"), "UTC")).toBe(
        "2024-06-15",
      );
    });
  });
});
