"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { computeLocalDate } from "@/domain/date";
import {
  addDayCounts,
  pendingDayCount,
  raiseTodayFloor,
  visibleTodayTotals,
  type DayCount,
} from "@/domain/today-totals";
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

  const localDate =
    todayQuery.data?.localDate ?? computeLocalDate(new Date(), tz);
  const pending = outbox.filter((row) => row.localDate === localDate);
  const server: DayCount = {
    totalReps: todayQuery.data?.totalReps ?? 0,
    setCount: todayQuery.data?.setCount ?? 0,
  };
  const pendingTotals = pendingDayCount(pending);
  const combined = addDayCounts(server, pendingTotals);

  const [floor, setFloor] = useState<(DayCount & { localDate: string }) | null>(
    null,
  );
  const previousPendingCount = useRef(0);
  const snapshotUpdatedAt = useRef<number | null>(null);

  const floorForDate = floor?.localDate === localDate ? floor : null;
  const nextFloor =
    pending.length > 0
      ? { ...raiseTodayFloor(floorForDate, combined), localDate }
      : floorForDate;
  if (
    nextFloor?.totalReps !== floor?.totalReps ||
    nextFloor?.setCount !== floor?.setCount ||
    nextFloor?.localDate !== floor?.localDate
  ) {
    setFloor(nextFloor);
  }

  const visible = visibleTodayTotals(server, pendingTotals, nextFloor);

  // Refetch only after the outbox shrinks (a drain), never when a set is
  // first queued — that in-flight GET can still see 0 and overwrite the
  // cache after the POST has already succeeded.
  useEffect(() => {
    if (pending.length < previousPendingCount.current) {
      snapshotUpdatedAt.current = todayQuery.dataUpdatedAt;
      const filter = trpc.days.today.queryFilter({ tz });
      void queryClient.cancelQueries(filter).then(() => {
        void queryClient.invalidateQueries(filter);
      });
    }
    previousPendingCount.current = pending.length;
  }, [pending.length, queryClient, todayQuery.dataUpdatedAt, trpc, tz]);

  useEffect(() => {
    if (
      snapshotUpdatedAt.current === null ||
      pending.length > 0 ||
      todayQuery.isFetching ||
      todayQuery.dataUpdatedAt === snapshotUpdatedAt.current
    ) {
      return;
    }
    snapshotUpdatedAt.current = null;
    setFloor(null);
  }, [pending.length, todayQuery.dataUpdatedAt, todayQuery.isFetching]);

  return {
    tz,
    localDate,
    totalReps: visible.totalReps,
    setCount: visible.setCount,
    pendingCount: outbox.length,
    isSyncing: outbox.length > 0,
  };
}
