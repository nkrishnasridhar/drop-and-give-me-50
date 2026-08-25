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
