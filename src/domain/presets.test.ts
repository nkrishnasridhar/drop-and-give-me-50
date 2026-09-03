import { describe, expect, it } from "vitest";
import { DEFAULT_PRESETS, learnPresets } from "./presets";

describe("learnPresets", () => {
  it("returns the defaults when there is not enough history", () => {
    expect(learnPresets([])).toEqual([...DEFAULT_PRESETS]);
    expect(learnPresets([15, 15, 15, 15])).toEqual([...DEFAULT_PRESETS]);
  });

  it("returns the three most frequent sizes once history exists", () => {
    const history = [
      ...Array.from({ length: 8 }, () => 12),
      ...Array.from({ length: 5 }, () => 25),
      ...Array.from({ length: 3 }, () => 8),
      50,
    ];
    expect(learnPresets(history)).toEqual([8, 12, 25]);
  });

  it("fills with defaults if fewer than three distinct sizes have been logged", () => {
    const history = Array.from({ length: 10 }, () => 15);
    expect(learnPresets(history)).toEqual([10, 15, 20]);
  });

  it("ignores out-of-range values", () => {
    const history = [20, 20, 20, 20, 20, 0, 999, -4];
    expect(learnPresets(history)).toEqual([10, 20, 50]);
  });
});
