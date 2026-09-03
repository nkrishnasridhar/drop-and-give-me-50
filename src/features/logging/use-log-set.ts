"use client";

import { useQueryClient } from "@tanstack/react-query";
import { computeLocalDate } from "@/domain/date";
import type { ClientSetSource } from "@/domain/set";
import { enqueueOutbox, recordLocalLog } from "@/lib/offline/db";
import { confirmHaptic } from "@/lib/offline/haptics";
import { drainOutbox, requestBackgroundSync } from "@/lib/offline/sync";
import { generateUuidV7 } from "@/lib/uuid";
import { useTimeZone } from "@/features/logging/use-today";

export function useLogSet() {
  const queryClient = useQueryClient();
  const tz = useTimeZone();

  async function logSet(input: {
    variationId: string;
    reps: number;
    note?: string;
    source: ClientSetSource;
  }): Promise<void> {
    const occurredAt = new Date();
    await enqueueOutbox({
      id: generateUuidV7(),
      variationId: input.variationId,
      reps: input.reps,
      occurredAt: occurredAt.toISOString(),
      tz,
      note: input.note,
      source: input.source,
      localDate: computeLocalDate(occurredAt, tz),
      queuedAt: Date.now(),
    });
    await recordLocalLog(input.reps, input.variationId);
    await queryClient.invalidateQueries({ queryKey: ["local"] });
    confirmHaptic();
    void requestBackgroundSync();
    void drainOutbox();
  }

  return { logSet };
}
