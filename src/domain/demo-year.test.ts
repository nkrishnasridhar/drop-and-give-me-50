import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import {
  buildDemoYear,
  DEMO_SPAN_DAYS,
  DEMO_VARIATIONS,
  summarizeDemoYear,
} from "./demo-year";

const TODAY = "2026-09-17";

describe("buildDemoYear", () => {
  it("covers 365 civil days ending yesterday", () => {
    const days = buildDemoYear(TODAY);
    const summary = summarizeDemoYear(days);

    expect(summary.days).toBe(DEMO_SPAN_DAYS);
    expect(summary.firstDate).toBe(addDays(TODAY, -DEMO_SPAN_DAYS));
    expect(summary.lastDate).toBe(addDays(TODAY, -1));
  });

  it("mixes training, rest, and gaps so consistency is not 100%", () => {
    const summary = summarizeDemoYear(buildDemoYear(TODAY));

    expect(summary.train).toBeGreaterThan(150);
    expect(summary.rest).toBeGreaterThan(30);
    expect(summary.off).toBeGreaterThan(80);
    expect(summary.train + summary.rest + summary.off).toBe(DEMO_SPAN_DAYS);

    const activeShare = (summary.train + summary.rest) / summary.days;
    expect(activeShare).toBeGreaterThan(0.45);
    expect(activeShare).toBeLessThan(0.85);
  });

  it("logs real volume across several seeded variations", () => {
    const summary = summarizeDemoYear(buildDemoYear(TODAY));
    const allowed = new Set<string>(DEMO_VARIATIONS);

    expect(summary.reps).toBeGreaterThan(5_000);
    expect(summary.sets).toBeGreaterThan(200);
    expect(summary.variations.length).toBeGreaterThanOrEqual(4);
    for (const id of summary.variations) {
      expect(allowed.has(id)).toBe(true);
    }
  });

  it("is deterministic for the same today and seed", () => {
    const a = buildDemoYear(TODAY, 50);
    const b = buildDemoYear(TODAY, 50);
    expect(a).toEqual(b);
    expect(buildDemoYear(TODAY, 7)).not.toEqual(a);
  });

  it("keeps every set inside representable bounds", () => {
    for (const day of buildDemoYear(TODAY)) {
      if (day.kind !== "train") continue;
      expect(day.sets.length).toBeGreaterThan(0);
      for (const set of day.sets) {
        expect(set.reps).toBeGreaterThanOrEqual(1);
        expect(set.reps).toBeLessThanOrEqual(50);
        expect(set.hour).toBeGreaterThanOrEqual(0);
        expect(set.hour).toBeLessThanOrEqual(23);
        expect(set.minute).toBeGreaterThanOrEqual(0);
        expect(set.minute).toBeLessThan(60);
      }
    }
  });
});
