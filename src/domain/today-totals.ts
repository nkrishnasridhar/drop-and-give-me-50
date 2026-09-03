export interface DayCount {
  totalReps: number;
  setCount: number;
}

export function addDayCounts(a: DayCount, b: DayCount): DayCount {
  return {
    totalReps: a.totalReps + b.totalReps,
    setCount: a.setCount + b.setCount,
  };
}

export function pendingDayCount(rows: readonly { reps: number }[]): DayCount {
  return {
    totalReps: rows.reduce((sum, row) => sum + row.reps, 0),
    setCount: rows.length,
  };
}

/**
 * Floor is the highest Today total we have already shown. After a drain
 * the outbox is empty while `days.today` still holds the pre-drain
 * snapshot — without a floor the UI dips to that snapshot, then jumps
 * back when the refetch lands (docs/decisions.md #12).
 *
 * Floor is an absolute count, not an overlay, so a late refetch that
 * already includes the set cannot double-count.
 */
export function raiseTodayFloor(
  floor: DayCount | null,
  visible: DayCount,
): DayCount {
  if (
    floor &&
    floor.totalReps >= visible.totalReps &&
    floor.setCount >= visible.setCount
  ) {
    return floor;
  }
  return visible;
}

export function visibleTodayTotals(
  server: DayCount,
  pending: DayCount,
  floor: DayCount | null,
): DayCount {
  const combined = addDayCounts(server, pending);
  if (!floor) return combined;
  return {
    totalReps: Math.max(combined.totalReps, floor.totalReps),
    setCount: Math.max(combined.setCount, floor.setCount),
  };
}
