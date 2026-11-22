import { describe, expect, it } from "vitest";
import {
  DAILY_REMINDER,
  formatReminderTime,
  isReminderDue,
  normalizeReminderTime,
  pickReminderBody,
  REMINDER_BODIES,
  reminderPayload,
  reminderTimeToMinutes,
  snapReminderMinutes,
} from "./reminder";

const tz = "UTC";

function due(partial: Partial<Parameters<typeof isReminderDue>[0]> = {}) {
  return isReminderDue({
    now: new Date("2024-06-12T18:00:00Z"),
    timeZone: tz,
    dayStartOffsetMinutes: 0,
    reminderEnabled: true,
    reminderTime: "18:00",
    lastSuccessAt: null,
    todayCompleted: false,
    ...partial,
  });
}

describe("pickReminderBody", () => {
  it("keeps every line short enough for a notification preview", () => {
    for (const line of REMINDER_BODIES) {
      expect(line.length).toBeLessThanOrEqual(50);
    }
  });

  it("hits the first and last lines from the ends of the random range", () => {
    expect(pickReminderBody(() => 0)).toBe(REMINDER_BODIES[0]);
    expect(pickReminderBody(() => 1 - Number.EPSILON)).toBe(
      REMINDER_BODIES[REMINDER_BODIES.length - 1],
    );
  });

  it("keeps the title and url fixed while the body comes from the pool", () => {
    const payload = reminderPayload(() => 0);
    expect(payload.title).toBe(DAILY_REMINDER.title);
    expect(payload.url).toBe(DAILY_REMINDER.url);
    expect(REMINDER_BODIES).toContain(payload.body);
    expect(payload.body).toBe(REMINDER_BODIES[0]);
  });
});

describe("reminderTimeToMinutes", () => {
  it("parses HH:MM and HH:MM:SS", () => {
    expect(reminderTimeToMinutes("18:00")).toBe(18 * 60);
    expect(reminderTimeToMinutes("09:15:00")).toBe(9 * 60 + 15);
  });

  it("rejects junk", () => {
    expect(reminderTimeToMinutes("nope")).toBeNull();
    expect(reminderTimeToMinutes("24:00")).toBeNull();
  });
});

describe("snapReminderMinutes", () => {
  it("snaps down onto the 15-minute reminder grid", () => {
    expect(snapReminderMinutes(18 * 60 + 7)).toBe(18 * 60);
    expect(formatReminderTime(23 * 60 + 50)).toBe("23:45");
  });

  it("normalizes stored times", () => {
    expect(normalizeReminderTime("18:07:00")).toBe("18:00");
  });
});

describe("isReminderDue", () => {
  it("is false when reminders are off or the time is missing", () => {
    expect(due({ reminderEnabled: false })).toBe(false);
    expect(due({ reminderTime: null })).toBe(false);
  });

  it("is false before the local reminder time", () => {
    expect(due({ now: new Date("2024-06-12T17:59:00Z") })).toBe(false);
  });

  it("is true once the local reminder time has arrived", () => {
    expect(due({ now: new Date("2024-06-12T18:00:00Z") })).toBe(true);
    expect(due({ now: new Date("2024-06-12T21:10:00Z") })).toBe(true);
  });

  it("skips when today is already a completed day", () => {
    expect(due({ todayCompleted: true })).toBe(false);
  });

  it("skips when a push already succeeded on this local date", () => {
    expect(
      due({ lastSuccessAt: new Date("2024-06-12T08:00:00Z") }),
    ).toBe(false);
  });

  it("fires again the next local day", () => {
    expect(
      due({
        now: new Date("2024-06-13T18:00:00Z"),
        lastSuccessAt: new Date("2024-06-12T18:05:00Z"),
      }),
    ).toBe(true);
  });

  it("uses the stored IANA zone, not UTC", () => {
    // 18:00 UTC is 06:00 the next calendar day in Auckland (NZST UTC+12).
    expect(
      due({
        now: new Date("2024-06-12T18:00:00Z"),
        timeZone: "Pacific/Auckland",
        reminderTime: "18:00",
      }),
    ).toBe(false);
    expect(
      due({
        now: new Date("2024-06-12T06:00:00Z"),
        timeZone: "Pacific/Auckland",
        reminderTime: "18:00",
      }),
    ).toBe(true);
  });
});
