import { initTRPC } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { LogSetPayload } from "@/domain/set";
import {
  postLogSet,
  readTrpcErrorCode,
  serializeLogSetBody,
} from "./post";

const payload: LogSetPayload = {
  id: "0191a6c0-7c3d-7e12-8a3b-1c2d3e4f5a6b",
  variationId: "regular",
  reps: 10,
  occurredAt: "2024-06-15T12:00:00.000Z",
  tz: "Pacific/Auckland",
  source: "app",
};

const logSetInput = z.object({
  id: z.string().uuid(),
  variationId: z.string().min(1),
  reps: z.number().int().min(1).max(500),
  occurredAt: z.string().datetime(),
  tz: z.string().min(1),
  note: z.string().max(500).optional(),
  source: z.enum(["app", "shortcut"]).default("app"),
});

const t = initTRPC.create();
const router = t.router({
  sets: t.router({
    log: t.procedure.input(logSetInput).mutation(({ input }) => input),
  }),
});

async function postToHandler(body: unknown): Promise<Response> {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: new Request("http://localhost/api/trpc/sets.log", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    router,
    createContext: () => ({}),
  });
}

describe("serializeLogSetBody", () => {
  it("sends the raw input tRPC v11 expects, not a { json } envelope", () => {
    expect(JSON.parse(serializeLogSetBody(payload))).toEqual(payload);
  });
});

describe("tRPC v11 mutation envelope", () => {
  it("accepts the raw payload the outbox now posts", async () => {
    const response = await postToHandler(payload);
    const body = (await response.json()) as { result?: { data?: LogSetPayload } };

    expect(response.ok).toBe(true);
    expect(body.result?.data?.id).toBe(payload.id);
  });

  it("rejects the old { json: payload } wrapper as BAD_REQUEST", async () => {
    const response = await postToHandler({ json: payload });
    const body: unknown = await response.json();

    expect(response.ok).toBe(false);
    expect(readTrpcErrorCode(body)).toBe("BAD_REQUEST");
  });
});

describe("readTrpcErrorCode", () => {
  it("reads a flat tRPC error envelope", () => {
    expect(
      readTrpcErrorCode({ error: { data: { code: "CONFLICT" } } }),
    ).toBe("CONFLICT");
  });

  it("reads a transformer-wrapped error envelope", () => {
    expect(
      readTrpcErrorCode({
        error: { json: { data: { code: "BAD_REQUEST" } } },
      }),
    ).toBe("BAD_REQUEST");
  });
});

describe("postLogSet", () => {
  it("POSTs the raw payload with credentials included", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: { data: payload } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await postLogSet(payload);

    expect(fetchMock).toHaveBeenCalledWith("/api/trpc/sets.log", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: serializeLogSetBody(payload),
    });
    vi.unstubAllGlobals();
  });
});
