import { sendNotification, setVapidDetails, WebPushError } from "web-push";
import { reminderPayload } from "@/domain/reminder";
import { env } from "@/lib/env";

export type PushSendResult = "sent" | "gone" | "failed";

export function getVapidPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

function ensureVapid(): void {
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Web Push is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT.",
    );
  }
  setVapidDetails(subject, publicKey, privateKey);
}

export async function sendPushPayload(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  payload: { title: string; body: string; url: string };
}): Promise<PushSendResult> {
  ensureVapid();
  try {
    await sendNotification(
      {
        endpoint: input.endpoint,
        keys: { p256dh: input.p256dh, auth: input.auth },
      },
      JSON.stringify(input.payload),
      {
        TTL: 60 * 60 * 4,
        urgency: "normal",
        topic: "daily-reminder",
      },
    );
    return "sent";
  } catch (caught) {
    if (caught instanceof WebPushError && (caught.statusCode === 404 || caught.statusCode === 410)) {
      return "gone";
    }
    return "failed";
  }
}

export function dailyReminderPayload(
  random: () => number = Math.random,
): { title: string; body: string; url: string } {
  return reminderPayload(random);
}
