"use client";

import { useQuery } from "@tanstack/react-query";
import { useIsClient } from "@/features/logging/use-today";
import { useTRPC } from "@/lib/trpc";

export function useSettings() {
  const trpc = useTRPC();
  const isClient = useIsClient();
  const query = useQuery({
    ...trpc.settings.get.queryOptions(),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });

  return {
    weeklyTargetDays: query.data?.weeklyTargetDays ?? 5,
    dailyRepGoal: query.data?.dailyRepGoal ?? 50,
    dayStartOffsetMinutes: query.data?.dayStartOffsetMinutes ?? 0,
    hapticsEnabled: query.data?.hapticsEnabled ?? true,
    onboardedAt: query.data?.onboardedAt ?? null,
    disclaimerAcceptedAt: query.data?.disclaimerAcceptedAt ?? null,
    isLoading: isClient && query.isLoading,
  };
}
