import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@/server/api/root";

/**
 * A vanilla tRPC client for the one client component that needs to call a
 * mutation directly (the Log form). React Query bindings are deferred to
 * Phase 2 — that's when they earn their place, as the foundation for the
 * IndexedDB outbox and optimistic UI (docs/architecture.md §1), not
 * before. This client has no cache; every call hits the network.
 */
export const trpcClient = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});
