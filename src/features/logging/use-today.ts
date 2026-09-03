"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useSyncExternalStore } from "react";
import { computeLocalDate } from "@/domain/date";
import type { OutboxRow } from "@/lib/offline/db";
import { listOutbox } from "@/lib/offline/db";
import { drainOutbox, subscribeToOutbox } from "@/lib/offline/sync";
import { useTRPC } from "@/lib/trpc";

function subscribeNoop() {
  return () => {};
}

export function useTimeZone(): string {
  return useSyncExternalStore(
    subscribeNoop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => "UTC",
  );
}

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function useOutbox(): OutboxRow[] {
  const [items, setItems] = useState<OutboxRow[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function pull() {
      const rows = await listOutbox();
      if (!cancelled) setItems(rows);
    }

    void pull();
    void drainOutbox().then(pull);
    const unsubscribe = subscribeToOutbox(() => {
      void pull();
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return items;
}

export function useTodayTotals() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tz = useTimeZone();
  const isClient = useIsClient();
  const outbox = useOutbox();
  const todayQuery = useQuery({
    ...trpc.days.today.queryOptions({ tz }),
    enabled: isClient,
  });

  useEffect(() => {
    return subscribeToOutbox(() => {
      void queryClient.invalidateQueries(trpc.days.today.queryFilter({ tz }));
    });
  }, [queryClient, trpc, tz]);

  const localDate =
    todayQuery.data?.localDate ?? computeLocalDate(new Date(), tz);
  const pending = outbox.filter((row) => row.localDate === localDate);

  // Cache is the last server snapshot. Pending outbox rows are added on
  // top so a log is visible immediately and we never wait on the network
  // (docs/decisions.md #12). After drain, the outbox empties and the
  // refetch lands on the same number.
  return {
    tz,
    localDate,
    totalReps:
      (todayQuery.data?.totalReps ?? 0) +
      pending.reduce((sum, row) => sum + row.reps, 0),
    setCount: (todayQuery.data?.setCount ?? 0) + pending.length,
    pendingCount: outbox.length,
    isSyncing: outbox.length > 0,
  };
}
