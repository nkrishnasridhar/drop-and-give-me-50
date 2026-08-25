import { describe, expect, it, vi } from "vitest";
import { env, requireEnv } from "./env";

describe("requireEnv", () => {
  it("returns the value when the environment variable is set", () => {
    vi.stubEnv("SOME_TEST_VAR", "hello");

    expect(requireEnv("SOME_TEST_VAR")).toBe("hello");

    vi.unstubAllEnvs();
  });

  it("throws a descriptive error when the environment variable is missing", () => {
    vi.stubEnv("MISSING_TEST_VAR", "");
    delete process.env.MISSING_TEST_VAR;

    expect(() => requireEnv("MISSING_TEST_VAR")).toThrow(
      /MISSING_TEST_VAR/,
    );

    vi.unstubAllEnvs();
  });
});

describe("env.DATABASE_URL", () => {
  it("reads DATABASE_URL lazily via a getter", () => {
    vi.stubEnv("DATABASE_URL", "postgres://example");

    expect(env.DATABASE_URL).toBe("postgres://example");

    vi.unstubAllEnvs();
  });

  it("throws only when actually accessed, not on import", () => {
    delete process.env.DATABASE_URL;

    expect(() => env.DATABASE_URL).toThrow(/DATABASE_URL/);
  });
});
