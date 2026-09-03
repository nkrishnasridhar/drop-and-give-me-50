import {
  classifyHttpDrainFailure,
  OutboxPostError,
} from "@/domain/outbox";
import type { LogSetPayload } from "@/domain/set";

interface TrpcErrorBody {
  error?: {
    data?: { code?: string };
    message?: string;
  };
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
      body: JSON.stringify({ json: payload }),
    });
  } catch (error) {
    throw new OutboxPostError(
      error instanceof Error ? error.message : "Network error",
      true,
    );
  }

  const body = (await response.json().catch(() => null)) as TrpcErrorBody | null;
  const trpcCode = body?.error?.data?.code;

  if (!response.ok || body?.error) {
    throw classifyHttpDrainFailure(response.status, trpcCode);
  }
}
