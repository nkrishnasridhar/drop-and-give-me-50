import {
  classifyHttpDrainFailure,
  OutboxPostError,
} from "@/domain/outbox";
import type { LogSetPayload } from "@/domain/set";

/**
 * tRPC v11's default transformer is identity, so a mutation body is the
 * raw input — not `{ json: input }`. Wrapping it makes Zod see `{ json }`
 * as the procedure input, returns BAD_REQUEST, and the outbox drops the
 * set (optimistic total flashes, then snaps back to the server snapshot).
 */
export function serializeLogSetBody(payload: LogSetPayload): string {
  return JSON.stringify(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Reads `error.data.code` from a tRPC HTTP error envelope, including the
 * `{ error: { json: { data } } }` wrapper some transformers add.
 */
export function readTrpcErrorCode(body: unknown): string | undefined {
  if (!isRecord(body) || !isRecord(body.error)) return undefined;

  const error = isRecord(body.error.json) ? body.error.json : body.error;
  if (!isRecord(error.data)) return undefined;

  return typeof error.data.code === "string" ? error.data.code : undefined;
}

function hasTrpcError(body: unknown): boolean {
  return isRecord(body) && isRecord(body.error);
}

/**
 * Posts a set through the existing tRPC HTTP handler. Used by both the
 * page drain and the service worker so a closed tab can still flush the
 * outbox (cookies are same-origin, `credentials: "include"`).
 */
export async function postLogSet(payload: LogSetPayload): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/trpc/sets.log", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: serializeLogSetBody(payload),
    });
  } catch (error) {
    throw new OutboxPostError(
      error instanceof Error ? error.message : "Network error",
      true,
    );
  }

  const body: unknown = await response.json().catch(() => null);
  const trpcCode = readTrpcErrorCode(body);

  if (!response.ok || hasTrpcError(body)) {
    throw classifyHttpDrainFailure(response.status, trpcCode);
  }
}
