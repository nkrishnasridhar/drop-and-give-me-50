import Dexie, { type EntityTable } from "dexie";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import type { LogSetPayload } from "@/domain/set";
import type { DayCount } from "@/domain/today-totals";

export interface OutboxRow extends LogSetPayload {
  localDate: string;
  queuedAt: number;
}

interface PrefRow {
  key: string;
  value: unknown;
}

interface QueryCacheRow {
  id: string;
  client: PersistedClient;
}

const QUERY_CACHE_ID = "tanstack";

class AppDatabase extends Dexie {
  outbox!: EntityTable<OutboxRow, "id">;
  prefs!: EntityTable<PrefRow, "key">;
  queryCache!: EntityTable<QueryCacheRow, "id">;

  constructor() {
    super("drop-and-give-me-50");
    this.version(1).stores({
      outbox: "id, queuedAt, localDate",
      prefs: "key",
      queryCache: "id",
    });
  }
}

function createDb(): AppDatabase | null {
  if (typeof indexedDB === "undefined") return null;
  return new AppDatabase();
}

export const db = createDb();

export const OUTBOX_CHANNEL = "dgm50-outbox";
export const OUTBOX_SYNC_TAG = "outbox-drain";

export function notifyOutboxChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("dgm50:outbox"));
  }
  if (typeof BroadcastChannel !== "undefined") {
    new BroadcastChannel(OUTBOX_CHANNEL).postMessage({ type: "changed" });
  }
}

export async function enqueueOutbox(row: OutboxRow): Promise<void> {
  if (!db) throw new Error("IndexedDB is not available in this environment.");
  await db.outbox.put(row);
  notifyOutboxChanged();
}

export async function listOutbox(): Promise<OutboxRow[]> {
  if (!db) return [];
  return db.outbox.orderBy("queuedAt").toArray();
}

export async function removeOutboxIds(ids: readonly string[]): Promise<void> {
  if (!db || ids.length === 0) return;
  await db.outbox.bulkDelete([...ids]);
  notifyOutboxChanged();
}

const RECENT_REPS_KEY = "recentReps";
const LAST_VARIATION_KEY = "lastVariationId";
const LAST_COUNTER_KEY = "lastCounter";
const TODAY_FLOOR_KEY = "todayFloor";

export type PersistedTodayFloor = DayCount & { localDate: string };

function isPersistedTodayFloor(value: unknown): value is PersistedTodayFloor {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.totalReps === "number" &&
    typeof record.setCount === "number" &&
    typeof record.localDate === "string"
  );
}

export async function readTodayFloor(): Promise<PersistedTodayFloor | null> {
  if (!db) return null;
  const value = (await db.prefs.get(TODAY_FLOOR_KEY))?.value;
  return isPersistedTodayFloor(value) ? value : null;
}

export async function writeTodayFloor(
  floor: PersistedTodayFloor | null,
): Promise<void> {
  if (!db) return;
  if (!floor) {
    await db.prefs.delete(TODAY_FLOOR_KEY);
    return;
  }
  await db.prefs.put({ key: TODAY_FLOOR_KEY, value: floor });
}

export async function recordLocalLog(
  reps: number,
  variationId: string,
): Promise<void> {
  if (!db) return;
  const existing = (await db.prefs.get(RECENT_REPS_KEY))?.value;
  const previous = Array.isArray(existing)
    ? existing.filter((value): value is number => typeof value === "number")
    : [];
  await db.prefs.bulkPut([
    { key: RECENT_REPS_KEY, value: [...previous, reps].slice(-40) },
    { key: LAST_VARIATION_KEY, value: variationId },
    { key: LAST_COUNTER_KEY, value: reps },
  ]);
}

export async function readRecentReps(): Promise<number[]> {
  if (!db) return [];
  const existing = (await db.prefs.get(RECENT_REPS_KEY))?.value;
  return Array.isArray(existing)
    ? existing.filter((value): value is number => typeof value === "number")
    : [];
}

export async function readLastVariationId(): Promise<string | undefined> {
  if (!db) return undefined;
  const value = (await db.prefs.get(LAST_VARIATION_KEY))?.value;
  return typeof value === "string" ? value : undefined;
}

export async function readLastCounter(): Promise<number | undefined> {
  if (!db) return undefined;
  const value = (await db.prefs.get(LAST_COUNTER_KEY))?.value;
  return typeof value === "number" ? value : undefined;
}

export function createDexiePersister(): Persister {
  return {
    persistClient: async (client) => {
      if (!db) return;
      await db.queryCache.put({ id: QUERY_CACHE_ID, client });
    },
    restoreClient: async () => {
      if (!db) return undefined;
      const row = await db.queryCache.get(QUERY_CACHE_ID);
      return row?.client;
    },
    removeClient: async () => {
      if (!db) return;
      await db.queryCache.delete(QUERY_CACHE_ID);
    },
  };
}
