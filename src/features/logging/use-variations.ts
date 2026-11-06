"use client";

import { useQuery } from "@tanstack/react-query";
import { asVariationOptions } from "@/features/logging/map-variations";
import { useTRPC } from "@/lib/trpc";

export function useVariationOptions() {
  const trpc = useTRPC();
  const query = useQuery(trpc.variations.list.queryOptions());
  return asVariationOptions(query.data ?? []);
}
