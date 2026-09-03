/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { NetworkOnly, Serwist } from "serwist";
import { OUTBOX_CHANNEL, OUTBOX_SYNC_TAG } from "@/lib/offline/db";
import { drainOutbox } from "@/lib/offline/sync";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    ...defaultCache,
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();

self.addEventListener("sync", (event) => {
  const syncEvent = event as Event & {
    tag: string;
    waitUntil: (promise: Promise<unknown>) => void;
  };
  if (syncEvent.tag !== OUTBOX_SYNC_TAG) return;

  syncEvent.waitUntil(
    drainOutbox().then(() => {
      new BroadcastChannel(OUTBOX_CHANNEL).postMessage({ type: "drained" });
    }),
  );
});
