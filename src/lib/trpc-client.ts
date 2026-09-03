import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";

/**
 * Vanilla tRPC client used by the Query provider. Mutations that have
 * to survive a closed tab go through `postLogSet` instead, so the
 * service worker can call the same HTTP endpoint without React.
 */
export function createBrowserTRPCClient() {
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/api/trpc" })],
  });
}
