/**
 * Computes the "local date" a push-up set belongs to, per
 * docs/architecture.md §3 (`push_sets.local_date`): computed once at
 * write time from the user's IANA timezone and day-start offset, and
 * never re-derived from UTC at read time (docs/decisions.md #3).
 *
 * `dayStartOffsetMinutes` lets a user's day start later than local
 * midnight — e.g. an offset of 240 (4 hours) means a set logged at
 * 2am local still belongs to the previous day, which matters for
 * anyone who trains late at night.
 *
 * Implemented with `Intl.DateTimeFormat` only (no date library): the
 * "en-CA" locale formats dates as `YYYY-MM-DD` directly, which is both
 * what we want to store and what correctly accounts for DST, since the
 * underlying ICU timezone database — not our arithmetic — resolves the
 * wall-clock date for a given instant and zone.
 */
export function computeLocalDate(
  occurredAt: Date,
  timeZone: string,
  dayStartOffsetMinutes = 0,
): string {
  const adjusted = new Date(
    occurredAt.getTime() - dayStartOffsetMinutes * 60_000,
  );

  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(adjusted);
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Civil-date arithmetic on already-local `YYYY-MM-DD` strings. These are
 * not instants — `local_date` was frozen at write time — so UTC methods
 * are just a calendar, not a timezone conversion.
 */
export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  return `${utc.getUTCFullYear()}-${pad2(utc.getUTCMonth() + 1)}-${pad2(utc.getUTCDate())}`;
}

/** Monday = 0 … Sunday = 6, matching the weekly reset. */
export function weekdayMonday0(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  const sunday0 = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sunday0 + 6) % 7;
}

export function startOfWeekMonday(isoDate: string): string {
  return addDays(isoDate, -weekdayMonday0(isoDate));
}

export function enumerateDates(from: string, to: string): string[] {
  if (from > to) return [];
  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

export function compareIsoDates(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Inclusive civil-date window bound for heatmap / streak reads. */
export const MAX_STATS_RANGE_DAYS = 400;

export function formatCivilDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}
