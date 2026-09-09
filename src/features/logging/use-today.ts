"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { computeLocalDate, startOfWeekMonday } from "@/domain/date";
import {
  nextTodayFloor,
  pendingDayCount,
  visibleTodayTotals,
  type DayCount,
} from "@/domain/today-totals";
import { withPendingToday } from "@/domain/streak";
import type { OutboxRow, PersistedTodayFloor } from "@/lib/offline/db";
import {
  listOutbox,
  readTodayFloor,
  writeTodayFloor,
} from "@/lib/offline/db";
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

let memoryOutbox: OutboxRow[] = [];
let memoryFloor: PersistedTodayFloor | null = null;
let memoryHydrated = false;

function useOutboxState() {
  const [items, setItems] = useState<OutboxRow[]>(memoryOutbox);
  const [restoredFloor, setRestoredFloor] =
    useState<PersistedTodayFloor | null>(memoryFloor);
  const [hydrated, setHydrated] = useState(memoryHydrated);

  useEffect(() => {
    let cancelled = false;
    let initial = !memoryHydrated;
    let pullGeneration = 0;

    async function pull() {
      const generation = ++pullGeneration;
      const [rows, saved] = await Promise.all([listOutbox(), readTodayFloor()]);
      if (cancelled || generation !== pullGeneration) return;
      memoryOutbox = rows;
      setItems(rows);
      if (initial) {
        initial = false;
        memoryFloor = saved;
        memoryHydrated = true;
        setRestoredFloor(saved);
        setHydrated(true);
      }
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

  return { items, restoredFloor, hydrated };
}

export function useOutbox(): OutboxRow[] {
  return useOutboxState().items;
}

export function useTodayTotals() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tz = useTimeZone();
  const isClient = useIsClient();
  const { items: outbox, restoredFloor, hydrated } = useOutboxState();
  const todayQuery = useQuery({
    ...trpc.days.today.queryOptions({ tz }),
    enabled: isClient,
    refetchOnReconnect: false,
    placeholderData: (previousData) => previousData,
  });
  const settingsQuery = useQuery({
    ...trpc.settings.get.queryOptions(),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });

  const localDate =
    todayQuery.data?.localDate ??
    computeLocalDate(
      new Date(),
      tz,
      settingsQuery.data?.dayStartOffsetMinutes ?? 0,
    );
  const pending = outbox.filter((row) => row.localDate === localDate);
  const server: DayCount | null = todayQuery.data
    ? {
        totalReps: todayQuery.data.totalReps,
        setCount: todayQuery.data.setCount,
      }
    : null;
  const pendingTotals = pendingDayCount(pending);

  const [overlay, setOverlay] = useState<{
    floor: PersistedTodayFloor | null;
    previousPending: DayCount | null;
  }>({ floor: memoryFloor, previousPending: null });
  const previousPendingCount = useRef(0);
  const snapshotUpdatedAt = useRef<number | null>(null);

  const seededFloor = overlay.floor ?? (hydrated ? restoredFloor : null);
  const floorForDate =
    seededFloor?.localDate === localDate ? seededFloor : null;
  const hydration = hydrated && overlay.previousPending === null;
  const nextFloorCount = nextTodayFloor({
    floor: floorForDate,
    server,
    previousPending: overlay.previousPending ?? {
      totalReps: 0,
      setCount: 0,
    },
    pending: pendingTotals,
    hydration,
  });
  const nextFloor: PersistedTodayFloor | null = nextFloorCount
    ? { ...nextFloorCount, localDate }
    : floorForDate;
  const nextPreviousPending = hydrated ? pendingTotals : overlay.previousPending;
  const overlayChanged =
    nextFloor?.totalReps !== overlay.floor?.totalReps ||
    nextFloor?.setCount !== overlay.floor?.setCount ||
    nextFloor?.localDate !== overlay.floor?.localDate ||
    nextPreviousPending?.totalReps !== overlay.previousPending?.totalReps ||
    nextPreviousPending?.setCount !== overlay.previousPending?.setCount ||
    (nextPreviousPending === null) !== (overlay.previousPending === null);

  if (overlayChanged) {
    setOverlay({
      floor: nextFloor,
      previousPending: nextPreviousPending,
    });
  }

  const visible = visibleTodayTotals(server, pendingTotals, nextFloor);
  const weekStart =
    todayQuery.data?.ring?.weekStart ?? startOfWeekMonday(localDate);
  const targetDays = todayQuery.data?.ring?.targetDays ?? 5;
  const todayComplete =
    visible.setCount > 0 ||
    (todayQuery.data?.isRestDay ?? false) ||
    pending.length > 0;
  const completedDates = withPendingToday(
    todayQuery.data?.ring?.completedDates ?? [],
    localDate,
    todayComplete,
  );
  const activeDays = completedDates.filter(
    (date) => date >= weekStart && date <= localDate,
  ).length;

  useEffect(() => {
    if (!hydrated) return;
    // First paint after IDB restore still has React floor=null. Writing
    // that would wipe the persisted 165/10 and bring back the 60/3 flash.
    if (overlay.floor === null && restoredFloor && pending.length > 0) return;
    memoryFloor = overlay.floor;
    void writeTodayFloor(overlay.floor);
  }, [overlay.floor, hydrated, pending.length, restoredFloor]);

  // A reconnect GET that lands mid-drain writes a snapshot that already
  // includes some queued sets. Cancel it while anything is waiting.
  useEffect(() => {
    if (pending.length === 0) return;
    void queryClient.cancelQueries(trpc.days.today.queryFilter({ tz }));
  }, [pending.length, queryClient, trpc, tz]);

  // Refetch only after the outbox empties, never when a set is first
  // queued and never on reconnect — that in-flight GET can still see a
  // partial drain and overlap the overlay.
  useEffect(() => {
    if (
      pending.length === 0 &&
      previousPendingCount.current > 0
    ) {
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
    setOverlay((current) =>
      current.floor === null ? current : { ...current, floor: null },
    );
  }, [pending.length, todayQuery.dataUpdatedAt, todayQuery.isFetching]);

  return {
    tz,
    localDate,
    totalReps: visible.totalReps,
    setCount: visible.setCount,
    pendingCount: outbox.length,
    isSyncing: outbox.length > 0,
    isRestDay: todayQuery.data?.isRestDay ?? false,
    dailyRepGoal: todayQuery.data?.dailyRepGoal ?? 50,
    ring: {
      weekStart,
      activeDays,
      targetDays,
      completedDates,
    },
  };
}
