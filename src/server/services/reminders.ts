import { and, eq, or } from "drizzle-orm";
import { computeLocalDate } from "@/domain/date";
import { isReminderDue } from "@/domain/reminder";
import { dailyReminderPayload, sendPushPayload } from "@/lib/push/send";
import { db } from "@/server/db/client";
import { dailyStats, pushSubscriptions, userSettings } from "@/server/db/schema";

const FAILURE_DROP_AFTER = 14;

export interface ReminderRunResult {
  considered: number;
  sent: number;
  skipped: number;
  gone: number;
  failed: number;
}

/**
 * Sends at most one reminder per user per local day (docs/decisions.md #13)
 * to every live subscription for that user. Skips if they already logged
 * or marked rest, or if a push already succeeded today.
 */
export async function sendDueReminders(now = new Date()): Promise<ReminderRunResult> {
  const rows = await db
    .select({
      userId: userSettings.userId,
      reminderTime: userSettings.reminderTime,
      tz: userSettings.tz,
      dayStartOffsetMinutes: userSettings.dayStartOffsetMinutes,
      subscriptionId: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      lastSuccessAt: pushSubscriptions.lastSuccessAt,
      failureCount: pushSubscriptions.failureCount,
    })
    .from(userSettings)
    .innerJoin(pushSubscriptions, eq(pushSubscriptions.userId, userSettings.userId))
    .where(eq(userSettings.reminderEnabled, true));

  const byUser = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row);
    byUser.set(row.userId, list);
  }

  const result: ReminderRunResult = {
    considered: byUser.size,
    sent: 0,
    skipped: 0,
    gone: 0,
    failed: 0,
  };

  if (byUser.size === 0) return result;

  const localByUser = new Map<string, string>();
  for (const [userId, list] of byUser) {
    const first = list[0];
    localByUser.set(
      userId,
      computeLocalDate(now, first.tz, first.dayStartOffsetMinutes),
    );
  }

  const completed = new Set<string>();
  const dayFilters = [...localByUser.entries()].map(([userId, localDate]) =>
    and(eq(dailyStats.userId, userId), eq(dailyStats.localDate, localDate)),
  );
  if (dayFilters.length > 0) {
    const dayRows = await db
      .select({
        userId: dailyStats.userId,
        localDate: dailyStats.localDate,
        setCount: dailyStats.setCount,
        isRestDay: dailyStats.isRestDay,
      })
      .from(dailyStats)
      .where(or(...dayFilters));
    for (const day of dayRows) {
      if (day.setCount > 0 || day.isRestDay) {
        completed.add(`${day.userId}:${day.localDate}`);
      }
    }
  }

  for (const [userId, list] of byUser) {
    const first = list[0];
    const localDate = localByUser.get(userId)!;
    const lastSuccessAt = list.reduce<Date | null>((latest, row) => {
      if (!row.lastSuccessAt) return latest;
      if (!latest || row.lastSuccessAt > latest) return row.lastSuccessAt;
      return latest;
    }, null);

    const due = isReminderDue({
      now,
      timeZone: first.tz,
      dayStartOffsetMinutes: first.dayStartOffsetMinutes,
      reminderEnabled: true,
      reminderTime: first.reminderTime,
      lastSuccessAt,
      todayCompleted: completed.has(`${userId}:${localDate}`),
    });

    if (!due) {
      result.skipped += 1;
      continue;
    }

    const payload = dailyReminderPayload();
    let delivered = false;
    for (const sub of list) {
      if (sub.failureCount >= FAILURE_DROP_AFTER) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.subscriptionId));
        result.gone += 1;
        continue;
      }

      const outcome = await sendPushPayload({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload,
      });

      if (outcome === "sent") {
        delivered = true;
        result.sent += 1;
        await db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: now, failureCount: 0 })
          .where(eq(pushSubscriptions.id, sub.subscriptionId));
      } else if (outcome === "gone") {
        result.gone += 1;
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.subscriptionId));
      } else {
        result.failed += 1;
        await db
          .update(pushSubscriptions)
          .set({ failureCount: sub.failureCount + 1 })
          .where(eq(pushSubscriptions.id, sub.subscriptionId));
      }
    }

    if (!delivered) result.skipped += 1;
  }

  return result;
}
