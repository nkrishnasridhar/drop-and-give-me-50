"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { inferRouterOutputs } from "@trpc/server";
import { addDays, computeLocalDate, MAX_STATS_RANGE_DAYS } from "@/domain/date";
import { computeWeekStreak, type DayStatus } from "@/domain/streak";
import { useIsClient, useTimeZone } from "@/features/logging/use-today";
import {
  invalidateHistoryViews,
  invalidateTodayIfIdle,
} from "@/lib/invalidate-memory";
import { useTRPC } from "@/lib/trpc";
import type { AppRouter } from "@/server/api/root";
import type { HistorySet } from "./types";

type SetListPage = inferRouterOutputs<AppRouter>["sets"]["list"];

export function useHistoryData() {
  const trpc = useTRPC();
  const tz = useTimeZone();
  const isClient = useIsClient();
  const todayQuery = useQuery({
    ...trpc.days.today.queryOptions({ tz }),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });
  const settingsQuery = useQuery({
    ...trpc.settings.get.queryOptions(),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });
  const today =
    todayQuery.data?.localDate ??
    computeLocalDate(
      new Date(),
      tz,
      settingsQuery.data?.dayStartOffsetMinutes ?? 0,
    );
  const from = addDays(today, -(MAX_STATS_RANGE_DAYS - 1));
  const rangeQuery = useQuery({
    ...trpc.days.range.queryOptions({ from, to: today }),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });
  const setsQuery = useInfiniteQuery(
    trpc.sets.list.infiniteQueryOptions(
      { limit: 40 },
      {
        enabled: isClient,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    ),
  );

  const range: DayStatus[] = rangeQuery.data ?? [];
  const sets: HistorySet[] =
    setsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const streak = computeWeekStreak({
    days: range,
    today,
    weeklyTargetDays: todayQuery.data?.ring?.targetDays ?? 5,
  });

  return {
    today,
    range,
    sets,
    streak,
    isLoading: isClient && (todayQuery.isLoading || rangeQuery.isLoading),
    hasMore: Boolean(setsQuery.hasNextPage),
    isFetchingMore: setsQuery.isFetchingNextPage,
    loadMore() {
      if (setsQuery.hasNextPage && !setsQuery.isFetchingNextPage) {
        void setsQuery.fetchNextPage();
      }
    },
  };
}

export function useSetMutations() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const update = useMutation(
    trpc.sets.update.mutationOptions({
      retry: 2,
      onSuccess: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
    }),
  );

  const remove = useMutation(
    trpc.sets.delete.mutationOptions({
      retry: 2,
      onMutate: async ({ id }) => {
        await queryClient.cancelQueries(trpc.sets.list.infiniteQueryFilter());
        queryClient.setQueriesData<InfiniteData<SetListPage>>(
          trpc.sets.list.infiniteQueryFilter(),
          (data) => {
            if (!data) return data;
            return {
              ...data,
              pages: data.pages.map((page) => ({
                ...page,
                items: page.items.filter((item) => item.id !== id),
              })),
            };
          },
        );
      },
      onError: () => {
        invalidateHistoryViews(queryClient, trpc);
      },
      onSettled: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
    }),
  );

  return { update, remove };
}
