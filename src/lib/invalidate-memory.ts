import type { QueryClient } from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { listOutbox } from "@/lib/offline/db";
import type { useTRPC } from "@/lib/trpc";
import type { AppRouter } from "@/server/api/root";

type TRPC = ReturnType<typeof useTRPC>;
type AppOutputs = inferRouterOutputs<AppRouter>;
type RangeRows = AppOutputs["days"]["range"];
type TodaySnapshot = AppOutputs["days"]["today"];

export function invalidateHistoryViews(
  queryClient: QueryClient,
  trpc: TRPC,
): void {
  void queryClient.invalidateQueries(trpc.days.range.pathFilter());
  void queryClient.invalidateQueries(trpc.sets.list.pathFilter());
  void queryClient.invalidateQueries(trpc.sets.list.infiniteQueryFilter());
}

/**
 * `days.today` stays off-limits while the log outbox is draining — a
 * mid-drain snapshot would fight the optimistic totals overlay.
 */
export async function invalidateTodayIfIdle(
  queryClient: QueryClient,
  trpc: TRPC,
): Promise<void> {
  const pending = await listOutbox();
  if (pending.length > 0) return;
  void queryClient.invalidateQueries(trpc.days.today.pathFilter());
}

export function patchRestDay(
  queryClient: QueryClient,
  trpc: TRPC,
  input: { localDate: string; isRestDay: boolean },
): void {
  queryClient.setQueriesData<RangeRows>(trpc.days.range.pathFilter(), (rows) => {
    if (!rows) return rows;
    const existing = rows.find((row) => row.localDate === input.localDate);
    if (existing) {
      return rows.map((row) =>
        row.localDate === input.localDate
          ? { ...row, isRestDay: input.isRestDay }
          : row,
      );
    }
    return [
      ...rows,
      {
        localDate: input.localDate,
        totalReps: 0,
        setCount: 0,
        volumeLoad: 0,
        isRestDay: input.isRestDay,
      },
    ];
  });

  queryClient.setQueriesData<TodaySnapshot>(trpc.days.today.pathFilter(), (today) => {
    if (!today) return today;
    if (
      !today.ring ||
      input.localDate < today.ring.weekStart ||
      input.localDate > today.localDate
    ) {
      return today;
    }

    const rangeRows = queryClient
      .getQueriesData<RangeRows>(trpc.days.range.pathFilter())
      .flatMap(([, data]) => data ?? []);
    const rangeDay = rangeRows.find((row) => row.localDate === input.localDate);
    const setCount =
      input.localDate === today.localDate
        ? today.setCount
        : (rangeDay?.setCount ?? 0);
    const nowComplete = setCount > 0 || input.isRestDay;
    const wasComplete = (today.ring.completedDates ?? []).includes(
      input.localDate,
    );
    let completedDates = today.ring.completedDates ?? [];
    if (nowComplete && !wasComplete) {
      completedDates = [...completedDates, input.localDate];
    } else if (!nowComplete && wasComplete) {
      completedDates = completedDates.filter((date) => date !== input.localDate);
    }

    return {
      ...today,
      isRestDay:
        input.localDate === today.localDate ? input.isRestDay : today.isRestDay,
      ring: {
        ...today.ring,
        completedDates,
        activeDays: completedDates.length,
      },
    };
  });
}
