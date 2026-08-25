import { describe, expect, it } from "vitest";
import { generateUuidV7 } from "./uuid";

const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateUuidV7", () => {
  it("produces a well-formed UUID with version 7 and variant bits set", () => {
    expect(generateUuidV7()).toMatch(UUID_V7_PATTERN);
  });

  it("produces unique values across many calls", () => {
    const ids = new Set(Array.from({ length: 10_000 }, () => generateUuidV7()));
    expect(ids.size).toBe(10_000);
  });

  it("sorts monotonically with generation time (the reason to use v7 over v4)", async () => {
    const first = generateUuidV7();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = generateUuidV7();

    expect(first < second).toBe(true);
  });
});
