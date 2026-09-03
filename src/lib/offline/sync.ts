import { drainOutboxItems } from "@/domain/outbox";
import type { LogSetPayload } from "@/domain/set";
import {
  listOutbox,
  OUTBOX_CHANNEL,
  OUTBOX_SYNC_TAG,
  removeOutboxIds,
} from "@/lib/offline/db";
import { postLogSet } from "@/lib/offline/post";

let draining: Promise<void> | null = null;

/**
 * Idempotent: each outbox row keeps its client UUIDv7, so a drain that
 * succeeds on the server but dies before we delete the row is safe to
 * run again (docs/decisions.md #2).
 */
export function drainOutbox(): Promise<void> {
  if (draining) return draining;
  draining = flush().finally(() => {
    draining = null;
  });
  return draining;
}

async function flush(): Promise<void> {
  const rows = await listOutbox();
  if (rows.length === 0) return;

  const payloads: LogSetPayload[] = rows.map((row) => ({
    id: row.id,
    variationId: row.variationId,
    reps: row.reps,
    occurredAt: row.occurredAt,
    tz: row.tz,
    note: row.note,
    source: row.source,
  }));

  const result = await drainOutboxItems(payloads, postLogSet);
  if (result.dropped.length > 0) {
    console.warn(
      "Dropped outbox sets the server rejected as un-saveable",
      result.dropped,
    );
  }
  await removeOutboxIds([...result.synced, ...result.dropped]);
}

export async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const syncManager = (
      registration as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      }
    ).sync;
    await syncManager?.register(OUTBOX_SYNC_TAG);
  } catch {
    // Background Sync is Android Chrome's nicety, not a requirement.
    // The `online` listener and the next app open still drain.
  }
}

export function subscribeToOutbox(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const onLocalChange = () => onChange();
  const onOnline = () => {
    void drainOutbox().then(onChange);
  };

  window.addEventListener("dgm50:outbox", onLocalChange);
  window.addEventListener("online", onOnline);

  let channel: BroadcastChannel | undefined;
  if (typeof BroadcastChannel !== "undefined") {
    channel = new BroadcastChannel(OUTBOX_CHANNEL);
    channel.onmessage = () => onChange();
  }

  return () => {
    window.removeEventListener("dgm50:outbox", onLocalChange);
    window.removeEventListener("online", onOnline);
    channel?.close();
  };
}
