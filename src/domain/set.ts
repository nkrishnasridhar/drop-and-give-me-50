export const SET_SOURCES = ["app", "shortcut", "backfill"] as const;
export type SetSource = (typeof SET_SOURCES)[number];

export const CLIENT_SET_SOURCES = ["app", "shortcut"] as const;
export type ClientSetSource = (typeof CLIENT_SET_SOURCES)[number];

/**
 * The payload `sets.log` accepts, generated on the client at tap time.
 * `occurredAt` is stamped locally so an offline set that syncs hours
 * later still belongs to the day it was actually done
 * (docs/decisions.md #3).
 */
export interface LogSetPayload {
  id: string;
  variationId: string;
  reps: number;
  occurredAt: string;
  tz: string;
  note?: string;
  source: ClientSetSource;
}
