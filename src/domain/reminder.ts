import { computeLocalDate, minutesInZone } from "@/domain/date";

/**
 * Reminder times snap to this grid in the UI. Delivery is driven by
 * Vercel Cron: Hobby only allows once-per-day expressions, so
 * `vercel.json` registers 24 daily jobs (one per UTC hour) against the
 * same `/api/cron/reminders` path — hourly coverage without a Pro plan.
 * On Pro, a single every-15-minutes schedule is enough.
 */
export const REMINDER_CRON_MINUTES = 15;
/** Last slot on the 15-minute grid before local midnight. */
export const LATEST_REMINDER_MINUTES = 23 * 60 + 45;
export const DEFAULT_REMINDER_TIME = "18:00";

export const DAILY_REMINDER = {
  title: "Drop and Give Me 50",
  body: "One set. That's the whole workout.",
  url: "/",
} as const;

const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;

export function reminderTimeToMinutes(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = TIME_RE.exec(value.trim());
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** Snap to the 15-minute grid so a 23:50 reminder is not skipped. */
export function snapReminderMinutes(minutes: number): number {
  const clamped = Math.max(0, Math.min(LATEST_REMINDER_MINUTES, minutes));
  return Math.floor(clamped / REMINDER_CRON_MINUTES) * REMINDER_CRON_MINUTES;
}

export function formatReminderTime(minutes: number): string {
  const snapped = snapReminderMinutes(minutes);
  const hour = Math.floor(snapped / 60);
  const minute = snapped % 60;
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function normalizeReminderTime(value: string | null | undefined): string | null {
  const minutes = reminderTimeToMinutes(value);
  if (minutes === null) return null;
  return formatReminderTime(minutes);
}

/**
 * Whether the daily reminder should fire for this user at `now`.
 *
 * Uses existing columns only: `reminder_enabled` / `reminder_time` /
 * `tz` / `day_start_offset_minutes`, plus `push_subscriptions.last_success_at`
 * as the per-day cap (docs/decisions.md #13). A successful test send counts
 * as today's notification — that is the product rule, not a missing column.
 */
export function isReminderDue(input: {
  now: Date;
  timeZone: string;
  dayStartOffsetMinutes: number;
  reminderEnabled: boolean;
  reminderTime: string | null;
  lastSuccessAt: Date | null;
  todayCompleted: boolean;
}): boolean {
  if (!input.reminderEnabled) return false;
  const reminderMinutes = reminderTimeToMinutes(input.reminderTime);
  if (reminderMinutes === null) return false;

  const localDate = computeLocalDate(
    input.now,
    input.timeZone,
    input.dayStartOffsetMinutes,
  );
  if (input.todayCompleted) return false;
  if (
    input.lastSuccessAt &&
    computeLocalDate(
      input.lastSuccessAt,
      input.timeZone,
      input.dayStartOffsetMinutes,
    ) === localDate
  ) {
    return false;
  }

  return minutesInZone(input.now, input.timeZone) >= snapReminderMinutes(reminderMinutes);
}
