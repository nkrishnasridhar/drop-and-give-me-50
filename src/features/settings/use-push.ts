"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { urlBase64ToUint8Array } from "@/lib/push/keys";
import { useTRPC } from "@/lib/trpc";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

export function usePushActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const subscribe = useMutation(trpc.push.subscribe.mutationOptions({ retry: 1 }));
  const unsubscribe = useMutation(
    trpc.push.unsubscribe.mutationOptions({ retry: 1 }),
  );
  const test = useMutation(trpc.push.sendTest.mutationOptions({ retry: 0 }));

  return {
    isPending: subscribe.isPending || unsubscribe.isPending || test.isPending,
    async enable(tz: string): Promise<void> {
      if (!pushSupported()) {
        throw new Error("This browser cannot receive web push.");
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notifications are blocked for this site.");
      }

      const { publicKey } = await queryClient.fetchQuery(
        trpc.push.publicKey.queryOptions(),
      );
      if (!publicKey) {
        throw new Error("Web Push is not configured on the server.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
        throw new Error("The browser returned an incomplete push subscription.");
      }
      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        userAgent: navigator.userAgent,
        tz,
      });
    },
    async disable(): Promise<void> {
      const subscription = await currentSubscription().catch(() => null);
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => undefined);
        await unsubscribe.mutateAsync({ endpoint }).catch(() => undefined);
      }
    },
    async sendTest(): Promise<void> {
      await test.mutateAsync();
    },
  };
}
