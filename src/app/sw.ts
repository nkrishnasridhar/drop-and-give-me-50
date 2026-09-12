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

self.addEventListener("push", (event) => {
  const pushEvent = event as PushEvent;
  let payload: { title?: string; body?: string; url?: string } = {};
  try {
    payload = pushEvent.data?.json() ?? {};
  } catch {
    payload = { body: pushEvent.data?.text() };
  }

  pushEvent.waitUntil(
    self.registration.showNotification(payload.title ?? "Drop and Give Me 50", {
      body: payload.body ?? "One set. That's the whole workout.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  const click = event as NotificationEvent;
  click.notification.close();
  const target = click.notification.data?.url ?? "/";
  click.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find(
        (client): client is WindowClient => "focus" in client,
      );
      if (existing) return existing.focus();
      return self.clients.openWindow(target);
    }),
  );
});

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
