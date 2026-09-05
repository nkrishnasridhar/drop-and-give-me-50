"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { HistoryScreen } from "@/features/history/history-screen";
import { LogScreen } from "@/features/logging/log-screen";
import { TabBar, type AppTab } from "@/features/shell/tab-bar";
import { useTRPC } from "@/lib/trpc";

/**
 * Precached fallback for document navigations when the network is gone.
 * Variations, history, and today's totals come from the Dexie-backed
 * TanStack Query cache populated during the last online visit.
 */
export default function OfflinePage() {
  const trpc = useTRPC();
  const variationsQuery = useQuery(trpc.variations.list.queryOptions());
  const [tab, setTab] = useState<AppTab>("log");

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
    <main className="appShell appShellWithTabs">
      {tab === "history" ? (
        <HistoryScreen variations={variationsQuery.data} />
      ) : (
        <LogScreen variations={variationsQuery.data} />
      )}
      <TabBar active={tab} onSelect={setTab} />
    </main>
  );
}
