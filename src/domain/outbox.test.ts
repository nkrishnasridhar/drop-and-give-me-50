import { describe, expect, it, vi } from "vitest";
import {
  classifyHttpDrainFailure,
  drainOutboxItems,
  OutboxPostError,
} from "./outbox";
import type { LogSetPayload } from "./set";

function payload(id: string): LogSetPayload {
  return {
    id,
    variationId: "regular",
    reps: 20,
    occurredAt: "2024-06-15T12:00:00.000Z",
    tz: "UTC",
    source: "app",
  };
}

describe("drainOutboxItems", () => {
  it("posts every item and reports them synced", async () => {
    const post = vi.fn().mockResolvedValue(undefined);
    const items = [payload("a"), payload("b"), payload("c")];

    const result = await drainOutboxItems(items, post);

    expect(post).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      synced: ["a", "b", "c"],
      dropped: [],
      remaining: [],
    });
  });

  it("stops on a retryable error and keeps that item plus everything after it", async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new OutboxPostError("offline", true))
      .mockResolvedValueOnce(undefined);

    const result = await drainOutboxItems(
      [payload("a"), payload("b"), payload("c")],
      post,
    );

    expect(post).toHaveBeenCalledTimes(2);
    expect(result.synced).toEqual(["a"]);
    expect(result.dropped).toEqual([]);
    expect(result.remaining.map((item) => item.id)).toEqual(["b", "c"]);
  });

  it("drops a non-retryable item and continues", async () => {
    const post = vi
      .fn()
      .mockRejectedValueOnce(new OutboxPostError("CONFLICT", false))
      .mockResolvedValueOnce(undefined);

    const result = await drainOutboxItems([payload("bad"), payload("ok")], post);

    expect(result.synced).toEqual(["ok"]);
    expect(result.dropped).toEqual(["bad"]);
    expect(result.remaining).toEqual([]);
  });

  it("treats unknown errors as retryable so sets are not silently lost", async () => {
    const post = vi.fn().mockRejectedValueOnce(new Error("boom"));

    const result = await drainOutboxItems([payload("a")], post);

    expect(result.remaining.map((item) => item.id)).toEqual(["a"]);
    expect(result.dropped).toEqual([]);
  });
});

describe("classifyHttpDrainFailure", () => {
  it("retries server failures and auth/rate-limit", () => {
    expect(classifyHttpDrainFailure(500, undefined).retryable).toBe(true);
    expect(classifyHttpDrainFailure(401, "UNAUTHORIZED").retryable).toBe(true);
    expect(classifyHttpDrainFailure(429, "TOO_MANY_REQUESTS").retryable).toBe(
      true,
    );
  });

  it("drops validation and conflict errors", () => {
    expect(classifyHttpDrainFailure(400, "BAD_REQUEST").retryable).toBe(false);
    expect(classifyHttpDrainFailure(409, "CONFLICT").retryable).toBe(false);
  });
});
