"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  invalidateHistoryViews,
  invalidateTodayIfIdle,
  patchRestDay,
} from "@/lib/invalidate-memory";
import { useTRPC } from "@/lib/trpc";
import { useTimeZone } from "@/features/logging/use-today";

export function useRestDay() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const tz = useTimeZone();

  const mark = useMutation(
    trpc.rest.mark.mutationOptions({
      retry: 2,
      onMutate: (input) => {
        if (!input.localDate) return;
        patchRestDay(queryClient, trpc, {
          localDate: input.localDate,
          isRestDay: true,
        });
      },
      onError: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
      onSettled: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
    }),
  );

  const unmark = useMutation(
    trpc.rest.unmark.mutationOptions({
      retry: 2,
      onMutate: (input) => {
        if (!input.localDate) return;
        patchRestDay(queryClient, trpc, {
          localDate: input.localDate,
          isRestDay: false,
        });
      },
      onError: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
      onSettled: () => {
        invalidateHistoryViews(queryClient, trpc);
        void invalidateTodayIfIdle(queryClient, trpc);
      },
    }),
  );

  return {
    tz,
    isPending: mark.isPending || unmark.isPending,
    toggle(localDate: string, currentlyRest: boolean) {
      if (currentlyRest) {
        unmark.mutate({ tz, localDate });
      } else {
        mark.mutate({ tz, localDate });
      }
    },
  };
}
