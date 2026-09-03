"use client";

import { useQuery } from "@tanstack/react-query";
import { LogScreen } from "@/features/logging/log-screen";
import { useTRPC } from "@/lib/trpc";

/**
 * Precached fallback for document navigations when the network is gone.
 * Variations and today's totals come from the Dexie-backed TanStack Query
 * cache populated during the last online visit.
 */
export default function OfflinePage() {
  const trpc = useTRPC();
  const variationsQuery = useQuery(trpc.variations.list.queryOptions());

  if (!variationsQuery.data?.length) {
    return (
      <main className="appShell">
        <p className="emptyState">
          Open the app once while online so variations live on this device.
          After that, logging works in airplane mode.
        </p>
      </main>
    );
  }

  return (
    <main className="appShell">
      <LogScreen variations={variationsQuery.data} />
    </main>
  );
}
