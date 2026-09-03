import type { LogSetPayload } from "./set";

export class OutboxPostError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "OutboxPostError";
    this.retryable = retryable;
  }
}

export function isRetryableOutboxError(error: unknown): boolean {
  if (error instanceof OutboxPostError) return error.retryable;
  // Unknown failures keep the row. Dropping a set because we didn't
  // recognise the error is how offline logs go missing.
  return true;
}

export interface DrainResult {
  synced: string[];
  dropped: string[];
  remaining: LogSetPayload[];
}

/**
 * Sequential drain. Stops (and keeps the rest) on the first retryable
 * failure so we don't hammer a dead network; drops only payloads the
 * server has rejected as un-saveable (validation / conflict).
 */
export async function drainOutboxItems(
  items: readonly LogSetPayload[],
  post: (item: LogSetPayload) => Promise<void>,
): Promise<DrainResult> {
  const synced: string[] = [];
  const dropped: string[] = [];
  const remaining: LogSetPayload[] = [];
  let blocked = false;

  for (const item of items) {
    if (blocked) {
      remaining.push(item);
      continue;
    }

    try {
      await post(item);
      synced.push(item.id);
    } catch (error) {
      if (isRetryableOutboxError(error)) {
        blocked = true;
        remaining.push(item);
      } else {
        dropped.push(item.id);
      }
    }
  }

  return { synced, dropped, remaining };
}

const RETRYABLE_TRPC_CODES = new Set([
  "UNAUTHORIZED",
  "TIMEOUT",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
  "BAD_GATEWAY",
  "SERVICE_UNAVAILABLE",
  "GATEWAY_TIMEOUT",
]);

export function classifyHttpDrainFailure(
  status: number,
  trpcCode: string | undefined,
): OutboxPostError {
  if (status >= 500) {
    return new OutboxPostError(trpcCode ?? `HTTP ${status}`, true);
  }
  if (trpcCode && RETRYABLE_TRPC_CODES.has(trpcCode)) {
    return new OutboxPostError(trpcCode, true);
  }
  if (status === 401 || status === 429) {
    return new OutboxPostError(trpcCode ?? `HTTP ${status}`, true);
  }
  return new OutboxPostError(trpcCode ?? `HTTP ${status}`, false);
}
