"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCivilDay } from "@/domain/date";
import { groupSetsByDay, mergeRestOnlyDays } from "@/domain/history";
import type { DayStatus } from "@/domain/streak";
import { Heatmap } from "@/features/history/heatmap";
import { SetEditSheet } from "@/features/history/set-edit-sheet";
import type { HistorySet } from "@/features/history/types";
import { useHistoryData, useSetMutations } from "@/features/history/use-history";
import type { VariationOption } from "@/features/logging/types";
import { useRestDay } from "@/features/logging/use-rest-day";
import styles from "./history-screen.module.css";

function formatSetTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function DayHeader({
  localDate,
  day,
  restPending,
  onToggleRest,
}: {
  localDate: string;
  day: DayStatus | undefined;
  restPending: boolean;
  onToggleRest: () => void;
}) {
  const isRest = day?.isRestDay ?? false;
  const reps = day?.totalReps ?? 0;
  const sets = day?.setCount ?? 0;
  return (
    <div className={styles.dayHeader}>
      <div>
        <h2 className={styles.dayTitle}>{formatCivilDay(localDate)}</h2>
        <p className={styles.dayMeta}>
          {isRest && sets === 0
            ? "Rest day"
            : `${reps} rep${reps === 1 ? "" : "s"} · ${sets} set${sets === 1 ? "" : "s"}`}
          {isRest && sets > 0 ? " · rest marked" : ""}
        </p>
      </div>
      <button
        type="button"
        className={isRest ? styles.restOn : styles.restOff}
        disabled={restPending}
        onClick={onToggleRest}
      >
        {isRest ? "Rest on" : "Rest"}
      </button>
    </div>
  );
}

export function HistoryScreen({ variations }: { variations: VariationOption[] }) {
  const data = useHistoryData();
  const rest = useRestDay();
  const mutations = useSetMutations();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editing, setEditing] = useState<HistorySet | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const selected = selectedDate ?? data.today;
  const dayMap = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (const row of data.range) map.set(row.localDate, row);
    return map;
  }, [data.range]);
  const groups = useMemo(() => {
    return mergeRestOnlyDays(
      groupSetsByDay(data.sets),
      data.range
        .filter((row) => row.isRestDay && row.setCount === 0)
        .map((row) => row.localDate),
    );
  }, [data.sets, data.range]);

  useEffect(() => {
    document
      .getElementById(`day-${selected}`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  const selectedInList = groups.some((group) => group.localDate === selected);
  const streak = data.streak;

  return (
    <div className={styles.screen}>
      <section className={styles.streak}>
        <p className={styles.streakValue}>
          {streak.current === 0
            ? `${streak.thisWeekCompleted} of ${streak.thisWeekTarget} this week`
            : `${streak.current} week streak`}
        </p>
        <p className={styles.streakMeta}>
          {streak.current > 0
            ? `This week ${streak.thisWeekCompleted} of ${streak.thisWeekTarget}`
            : "Rest days count. A missed week just starts a new one."}
          {streak.longest > 0 ? ` · Longest ${streak.longest}` : ""}
        </p>
      </section>

      <Heatmap
        today={data.today}
        days={dayMap}
        selectedDate={selected}
        onSelect={setSelectedDate}
      />

      {!selectedInList && selected <= data.today && groups.length > 0 && (
        <section id={`day-${selected}`} className={styles.dayGroup}>
          <DayHeader
            localDate={selected}
            day={dayMap.get(selected)}
            restPending={rest.isPending}
            onToggleRest={() =>
              rest.toggle(selected, dayMap.get(selected)?.isRestDay ?? false)
            }
          />
          <p className={styles.emptyDay}>Nothing logged.</p>
        </section>
      )}

      {groups.length > 0 && (
        <div className={styles.list}>
          {groups.map((group) => (
            <section
              key={group.localDate}
              id={`day-${group.localDate}`}
              className={
                group.localDate === selected
                  ? `${styles.dayGroup} ${styles.dayGroupSelected}`
                  : styles.dayGroup
              }
            >
              <DayHeader
                localDate={group.localDate}
                day={dayMap.get(group.localDate)}
                restPending={rest.isPending}
                onToggleRest={() =>
                  rest.toggle(
                    group.localDate,
                    dayMap.get(group.localDate)?.isRestDay ?? false,
                  )
                }
              />
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={styles.setRow}
                  onClick={() => {
                    setEditError(null);
                    setEditing(item);
                  }}
                >
                  <span className={styles.setReps}>{item.reps}</span>
                  <span className={styles.setBody}>
                    <span className={styles.setName}>{item.variationName}</span>
                    <span className={styles.setMeta}>
                      {formatSetTime(item.occurredAt)}
                    </span>
                  </span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {groups.length === 0 && data.range.length === 0 && !data.isLoading && (
        <p className={styles.empty}>Log a set and it lands here.</p>
      )}

      {data.hasMore && (
        <button
          type="button"
          className={styles.loadMore}
          disabled={data.isFetchingMore}
          onClick={() => data.loadMore()}
        >
          {data.isFetchingMore ? "Loading…" : "Earlier sets"}
        </button>
      )}

      <SetEditSheet
        set={editing}
        variations={variations}
        busy={mutations.update.isPending || mutations.remove.isPending}
        error={editError}
        onClose={() => {
          setEditing(null);
          setEditError(null);
        }}
        onSave={async (input) => {
          if (!editing) return;
          try {
            setEditError(null);
            await mutations.update.mutateAsync({ id: editing.id, ...input });
            setEditing(null);
          } catch (caught) {
            setEditError(
              caught instanceof Error ? caught.message : "Could not save that set.",
            );
          }
        }}
        onDelete={async () => {
          if (!editing) return;
          try {
            setEditError(null);
            await mutations.remove.mutateAsync({ id: editing.id });
            setEditing(null);
          } catch (caught) {
            setEditError(
              caught instanceof Error
                ? caught.message
                : "Could not delete that set.",
            );
          }
        }}
      />
    </div>
  );
}
