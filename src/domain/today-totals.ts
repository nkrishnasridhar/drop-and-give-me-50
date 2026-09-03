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
 * Floor is an absolute count, not an overlay. A live snapshot that
 * already includes queued sets must not be added on top of the outbox
 * (that is the 185/11 reconnect flash).
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

/**
 * Advance the floor when the user queues more sets. Hydration (IndexedDB
 * outbox appearing in one pull) must not treat those rows as new logs —
 * that would add them onto a live snapshot that may already include
 * them. Shrinks never lower the floor; the hook clears it once a fresh
 * `days.today` snapshot has caught up.
 */
export function nextTodayFloor(input: {
  floor: DayCount | null;
  server: DayCount | null;
  previousPending: DayCount;
  pending: DayCount;
  hydration: boolean;
}): DayCount | null {
  if (input.pending.setCount === 0) {
    return input.floor;
  }

  if (input.hydration) {
    if (input.floor) return input.floor;
    if (input.server) return addDayCounts(input.server, input.pending);
    return null;
  }

  const deltaReps = input.pending.totalReps - input.previousPending.totalReps;
  const deltaSets = input.pending.setCount - input.previousPending.setCount;
  if (deltaReps <= 0 && deltaSets <= 0) {
    return input.floor;
  }

  const base = input.floor ?? input.server ?? { totalReps: 0, setCount: 0 };
  return {
    totalReps: base.totalReps + Math.max(0, deltaReps),
    setCount: base.setCount + Math.max(0, deltaSets),
  };
}

/**
 * `server === null` means we do not have a snapshot yet (not "the day
 * is empty"). Missing data must not be treated as zero while outbox
 * rows are the only thing that has loaded — that is the 60/3 remount
 * flash.
 *
 * While anything is still queued, the live snapshot and the outbox can
 * overlap (a POST landed, the row is not deleted yet). Prefer the floor
 * over `server + pending` in that window.
 */
export function visibleTodayTotals(
  server: DayCount | null,
  pending: DayCount,
  floor: DayCount | null,
): DayCount {
  const knownServer = server ?? { totalReps: 0, setCount: 0 };

  if (pending.setCount > 0) {
    if (floor) {
      return {
        totalReps: Math.max(floor.totalReps, knownServer.totalReps),
        setCount: Math.max(floor.setCount, knownServer.setCount),
      };
    }
    if (server == null) {
      return pending;
    }
    return addDayCounts(server, pending);
  }

  if (!floor) return knownServer;
  return {
    totalReps: Math.max(knownServer.totalReps, floor.totalReps),
    setCount: Math.max(knownServer.setCount, floor.setCount),
  };
}
