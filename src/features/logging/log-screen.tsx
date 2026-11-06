"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { selectLogToast, type LogToast } from "@/domain/nudge";
import type { ClientSetSource } from "@/domain/set";
import { NudgeToast } from "@/features/logging/nudge-toast";
import { useLogSet } from "@/features/logging/use-log-set";
import { useRestDay } from "@/features/logging/use-rest-day";
import { useIsClient, useTodayTotals } from "@/features/logging/use-today";
import { VariationSheet } from "@/features/logging/variation-sheet";
import { WeekRing } from "@/features/logging/week-ring";
import { useVariationOptions } from "@/features/logging/use-variations";
import { readLastCounter, readLastVariationId } from "@/lib/offline/db";
import { useTRPC } from "@/lib/trpc";
import styles from "./log-screen.module.css";

function parseArmedReps(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 500) return undefined;
  return parsed;
}

export function LogScreen() {
  const params = useSearchParams();
  const armedReps = parseArmedReps(params.get("reps"));
  const source: ClientSetSource =
    params.get("source") === "shortcut" ? "shortcut" : "app";
  const variations = useVariationOptions();
  const { logSet } = useLogSet();
  const rest = useRestDay();
  const today = useTodayTotals();
  const trpc = useTRPC();
  const isClient = useIsClient();
  const overview = useQuery({
    ...trpc.stats.overview.queryOptions({ tz: today.tz }),
    enabled: isClient,
    placeholderData: (previous) => previous,
  });
  const [pickedVariationId, setPickedVariationId] = useState<string | null>(
    null,
  );
  const [counterOverride, setCounterOverride] = useState<number | null>(
    armedReps ?? null,
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<LogToast | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  const lastVariationQuery = useQuery({
    queryKey: ["local", "lastVariationId"],
    queryFn: readLastVariationId,
  });
  const lastCounterQuery = useQuery({
    queryKey: ["local", "lastCounter"],
    queryFn: readLastCounter,
  });

  const variationId =
    pickedVariationId ??
    (lastVariationQuery.data &&
    variations.some((variation) => variation.id === lastVariationQuery.data)
      ? lastVariationQuery.data
      : undefined) ??
    variations[0]?.id ??
    "";
  const selectedVariation = variations.find((variation) => variation.id === variationId);
  const reps = counterOverride ?? lastCounterQuery.data ?? 20;

  async function commit(nextReps: number, nextSource: ClientSetSource) {
    if (!variationId) {
      setError("Pick a variation first.");
      return;
    }
    if (!Number.isInteger(nextReps) || nextReps < 1 || nextReps > 500) {
      setError("Reps have to be between 1 and 500.");
      return;
    }

    setError(null);
    try {
      const nextToast = selectLogToast({
        reps: nextReps,
        previousTodayReps: today.totalReps,
        dailyRepGoal: today.dailyRepGoal,
        previousWeekActive: today.ring.activeDays,
        weeklyTargetDays: today.ring.targetDays,
        todayAlreadyComplete: today.ring.completedDates.includes(today.localDate),
        previousBiggestSet: overview.data?.biggestSetReps ?? null,
        previousBiggestDay: overview.data?.biggestDay?.totalReps ?? null,
        previousLifetimeReps: overview.data?.lifetimeReps ?? null,
      });
      await logSet({
        variationId,
        reps: nextReps,
        source: nextSource,
      });
      setCounterOverride(nextReps);
      setToast(nextToast);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save that set.",
      );
    }
  }

  return (
    <div className={styles.screen}>
      <NudgeToast toast={toast} onClear={clearToast} />
      <div className={styles.today} aria-live="polite">
        <p className={styles.todayLabel}>Today</p>
        <p
          className={styles.todayTotal}
          aria-label={`${today.totalReps} reps today`}
        >
          <motion.span
            key={today.totalReps}
            initial={{ y: 16, opacity: 0.35 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 520, damping: 34 }}
            style={{ display: "inline-block" }}
          >
            {today.totalReps}
          </motion.span>
        </p>
        <p className={styles.todayMeta}>
          {today.setCount} set{today.setCount === 1 ? "" : "s"}
          {today.dailyRepGoal > 0 ? ` · daily ${today.dailyRepGoal}` : ""}
        </p>
        {today.isSyncing && (
          <p className={styles.syncing}>
            Saved on this device · {today.pendingCount} waiting to sync
          </p>
        )}
      </div>

      <WeekRing
        activeDays={today.ring.activeDays}
        targetDays={today.ring.targetDays}
        completedDates={today.ring.completedDates}
        restDates={today.ring.restDates}
        weekStart={today.ring.weekStart}
        today={today.localDate}
      />

      <button
        type="button"
        className={today.isRestDay ? styles.restOn : styles.restOff}
        disabled={rest.isPending}
        onClick={() => rest.toggle(today.localDate, today.isRestDay)}
      >
        {today.isRestDay ? "Rest day" : "Mark today as rest"}
      </button>

      <div className={styles.variationRow}>
        <button
          type="button"
          className={styles.variationChip}
          onClick={() => setSheetOpen(true)}
        >
          {selectedVariation?.name ?? "Choose variation"}
        </button>
      </div>

      <div className={styles.counterBlock}>
        <p className={styles.counter}>
          <motion.span
            key={reps}
            initial={{ y: 10, opacity: 0.4 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 36 }}
            style={{ display: "inline-block" }}
          >
            {reps}
          </motion.span>
        </p>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="Decrease reps"
            disabled={reps <= 1}
            onClick={() => setCounterOverride(Math.max(1, reps - 1))}
          >
            −
          </button>
          <button
            type="button"
            aria-label="Increase reps"
            disabled={reps >= 500}
            onClick={() => setCounterOverride(Math.min(500, reps + 1))}
          >
            +
          </button>
        </div>
      </div>

      <button
        type="button"
        className={styles.primary}
        disabled={!variationId}
        onClick={() => void commit(reps, source)}
      >
        Log {reps}
      </button>

      {error && <p className={styles.error}>{error}</p>}

      <VariationSheet
        open={sheetOpen}
        variations={variations}
        selectedId={variationId}
        onSelect={setPickedVariationId}
        onClose={() => setSheetOpen(false)}
      />
    </div>
  );
}
