/**
 * Convert a VAPID public key (URL-safe base64) into the ArrayBuffer
 * `PushManager.subscribe` expects as `applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - (padded.length % 4)) % 4;
  const raw = atob(`${padded}${"=".repeat(padLength)}`);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
